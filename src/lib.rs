mod parser;

pub use parser::*;
use std::collections::{BTreeMap, BTreeSet};
use std::fmt::{self, Display, Formatter};
use std::iter::once;
use std::ops::RangeFrom;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
}

struct FA<T> {
    tf: BTreeMap<T, BTreeMap<String, BTreeSet<T>>>,
    start: BTreeSet<T>,
    accept: BTreeSet<T>,
}

type NFAState = u16;

#[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
struct DFAState(Vec<NFAState>);

impl From<Vec<NFAState>> for DFAState {
    fn from(inner: Vec<NFAState>) -> Self {
        Self(inner)
    }
}

impl fmt::Debug for DFAState {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "[")?;
        let mut ss = self.0.iter().peekable();
        while let Some(s) = ss.next() {
            write!(f, "{}", s)?;
            if ss.peek().is_some() {
                write!(f, ", ")?;
            }
        }
        write!(f, "]")
    }
}

impl Display for DFAState {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        for n in &self.0 {
            write!(f, "_{}", n)?;
        }
        Ok(())
    }
}

#[wasm_bindgen]
pub struct EpsilonNFA(FA<NFAState>);
#[wasm_bindgen]
pub struct NFA(FA<NFAState>);
#[wasm_bindgen]
pub struct DFA(FA<DFAState>);

#[wasm_bindgen]
impl EpsilonNFA {
    #[wasm_bindgen(constructor)]
    pub fn new(ast: AST) -> Self {
        let mut states = 1..;
        let start = states.next().unwrap();
        let accept = states.next().unwrap();
        let mut nfa = EpsilonNFA(FA {
            tf: BTreeMap::new(),
            start: BTreeSet::from([start]),
            accept: BTreeSet::from([accept]),
        });
        nfa.visit(&mut states, ast, start, accept);
        nfa
    }

    #[wasm_bindgen(js_name = toDot)]
    pub fn to_dot(self) -> Result<String, JsError> {
        Ok(self.0.try_into()?)
    }

    fn visit(&mut self, states: &mut RangeFrom<NFAState>, ast: AST, src: NFAState, dst: NFAState) {
        match ast.into_inner() {
            Inner::Symbol(sym) => {
                if src != dst || !sym.is_empty() {
                    self.0
                        .tf
                        .entry(src)
                        .or_default()
                        .entry(sym)
                        .or_default()
                        .insert(dst);
                }
            }
            Inner::Concatenate(lhs, rhs) => {
                let middle = states.next().unwrap();
                self.visit(states, lhs, src, middle);
                self.visit(states, rhs, middle, dst);
            }
            Inner::Or(lhs, rhs) => {
                self.visit(states, lhs, src, dst);
                self.visit(states, rhs, src, dst);
            }
            Inner::ZeroOrMore(oprn) => {
                let middle = states.next().unwrap();
                self.0
                    .tf
                    .entry(src)
                    .or_default()
                    .entry("".into())
                    .or_default()
                    .insert(middle);
                self.0
                    .tf
                    .entry(middle)
                    .or_default()
                    .entry("".into())
                    .or_default()
                    .insert(dst);
                self.visit(states, oprn, middle, middle);
            }
            Inner::OneOrMore(oprn) => {
                let rhs = AST::new(Inner::ZeroOrMore(oprn.clone()));
                let lhs = AST::new(Inner::Concatenate(oprn, rhs));
                self.visit(states, lhs, src, dst);
            }
        }
    }
}

#[wasm_bindgen]
impl NFA {
    #[wasm_bindgen(constructor)]
    pub fn new(ast: AST) -> Self {
        let nfa = EpsilonNFA::new(ast);
        let mut nfa = NFA(nfa.0);
        while let Some((s, d)) = nfa.take_epsilon_edge() {
            for (&src, symbols) in &mut nfa.0.tf {
                for (sym, dsts) in symbols {
                    if !(src == d && sym.is_empty()) && dsts.contains(&s) {
                        dsts.insert(d);
                    }
                }
            }
            if nfa.0.start.contains(&s) {
                nfa.0.start.insert(d);
            }
            if !nfa.0.tf.contains_key(&s) && !nfa.0.accept.contains(&s) {
                nfa.0.start.remove(&s);
                for symbols in nfa.0.tf.values_mut() {
                    for dsts in symbols.values_mut() {
                        dsts.remove(&s);
                    }
                }
            }
        }
        nfa
    }

    #[wasm_bindgen(js_name = toDot)]
    pub fn to_dot(self) -> Result<String, JsError> {
        Ok(self.0.try_into()?)
    }

    fn take_epsilon_edge(&mut self) -> Option<(NFAState, NFAState)> {
        for (&src, symbols) in self.0.tf.iter_mut() {
            if let Some(dsts) = symbols.get_mut("") {
                let dst = *dsts.iter().next().unwrap();
                let dst = dsts.take(&dst).unwrap();
                if dsts.is_empty() {
                    symbols.remove("");
                    if symbols.is_empty() {
                        self.0.tf.remove(&src);
                    }
                }
                return Some((src, dst));
            }
        }
        None
    }
}

#[wasm_bindgen]
impl DFA {
    #[wasm_bindgen(constructor)]
    pub fn new(ast: AST) -> Self {
        let nfa = NFA::new(ast);
        let mut start: DFAState = nfa.0.start.iter().copied().collect::<Vec<_>>().into();
        let mut accept = BTreeSet::new();
        let mut not_accept = BTreeSet::new();
        let mut tf = BTreeMap::new();
        let mut resolved_empty = BTreeSet::new();
        let mut unresolved = vec![(start.clone(), nfa.0.start)];
        while let Some((dfa_src, nfa_src)) = unresolved.pop() {
            let mut symbols: BTreeMap<_, BTreeSet<_>> = BTreeMap::new();
            let mut accept_some = false;
            nfa_src
                .into_iter()
                .inspect(|s| accept_some |= nfa.0.accept.contains(s))
                .filter_map(|s| nfa.0.tf.get(&s))
                .flatten()
                .filter(|(sym, _)| !sym.is_empty())
                .for_each(|(sym, dsts)| symbols.entry(sym.clone()).or_default().extend(dsts));
            if accept_some {
                accept.insert(dfa_src.clone());
            } else {
                not_accept.insert(dfa_src.clone());
            }
            if symbols.is_empty() {
                resolved_empty.insert(dfa_src);
            } else {
                let mut dfa_symbols = BTreeMap::new();
                for (sym, dsts) in symbols {
                    let dfa_dst = dsts.iter().copied().collect::<Vec<_>>().into();
                    if dfa_dst != dfa_src
                        && !tf.contains_key(&dfa_dst)
                        && !resolved_empty.contains(&dfa_dst)
                    {
                        unresolved.push((dfa_dst.clone(), dsts));
                    }
                    dfa_symbols.insert(sym, BTreeSet::from([dfa_dst]));
                }
                tf.insert(dfa_src, dfa_symbols);
            }
        }

        let mut grps = vec![accept.clone(), not_accept];
        's: loop {
            for (i, grp) in grps.iter().enumerate().filter(|(_, grp)| grp.len() > 1) {
                let mut new_grps: BTreeMap<Vec<_>, BTreeSet<_>> = BTreeMap::new();
                for state in grp {
                    let grp_ptr = |s: &BTreeSet<_>| {
                        grps.iter()
                            .find(|grp| grp.contains(s.iter().next().unwrap()))
                            .unwrap() as *const _
                    };
                    let key = tf
                        .get(state)
                        .iter()
                        .map(|s| s.iter())
                        .flatten()
                        .map(|(sym, dst)| (sym, grp_ptr(dst)))
                        .collect();
                    new_grps.entry(key).or_default().insert(state.clone());
                }
                if new_grps.len() > 1 {
                    grps.swap_remove(i);
                    grps.extend(new_grps.into_values());
                    continue 's;
                }
            }
            break;
        }

        for grp in grps.into_iter().filter(|grp| grp.len() > 1) {
            let mut states = grp.into_iter();
            let base = states.next().unwrap();
            if let Some(mut symbols) = tf.remove(&base) {
                for state in states {
                    let mut s = tf.remove(&state).unwrap();
                    for (sym, dsts) in &mut symbols {
                        dsts.extend(s.remove(sym).unwrap());
                    }
                    for symbols in tf.values_mut().chain(once(&mut symbols)) {
                        for dsts in symbols.values_mut() {
                            if dsts.remove(&state) {
                                dsts.insert(base.clone());
                            }
                        }
                    }
                    if state == start {
                        start = base.clone();
                    }
                    accept.remove(&state);
                }
                tf.insert(base, symbols);
            }
        }

        let start = BTreeSet::from([start]);
        DFA(FA { tf, start, accept })
    }

    #[wasm_bindgen(js_name = toDot)]
    pub fn to_dot(self) -> Result<String, JsError> {
        Ok(self.0.try_into()?)
    }
}

const DOT_HEADER: &str = r##"digraph {
	graph [pad=.3];
	edge [arrowsize=.6];
	node [style=filled,label="",fillcolor="#ffe066",margin=".01,.06"];
"##;

impl<T: Display + Clone + Ord> TryInto<String> for FA<T> {
    type Error = serde_json::Error;

    fn try_into(self) -> Result<String, Self::Error> {
        let mut dot = String::from(DOT_HEADER);
        for s in &self.start & &self.accept {
            dot.push('\t');
            dot += &format!(r##"{} [label="Start & Accept",fillcolor="#74c0fc"];"##, s);
            dot.push('\n');
        }
        for s in &self.start - &self.accept {
            dot.push('\t');
            dot += &format!(r##"{} [label="Start",fillcolor="#8ce99a"];"##, s);
            dot.push('\n');
        }
        for s in &self.accept - &self.start {
            dot.push('\t');
            dot += &format!(r##"{} [label="Accept",fillcolor="#ffa8a8"];"##, s);
            dot.push('\n');
        }
        for s in self
            .tf
            .iter()
            .map(|kv| once(kv.0).chain(kv.1.values().flatten()))
            .flatten()
            .filter(|s| !self.start.contains(s))
            .filter(|s| !self.accept.contains(s))
            .collect::<BTreeSet<_>>()
        {
            dot.push('\t');
            dot += &format!(r##"{} [shape=circle,width=.15,fixedsize=true];"##, s);
            dot.push('\n');
        }
        for (src, symbols) in self.tf {
            for (sym, dsts) in symbols {
                let sym = serde_json::to_string(&sym)?;
                let sym = &sym[1..sym.len() - 1];
                for dst in dsts {
                    dot.push('\t');
                    dot += &format!(r#"{} -> {} [label=" {}"];"#, src, dst, sym);
                    dot.push('\n');
                }
            }
        }
        dot.push('}');
        Ok(dot)
    }
}
