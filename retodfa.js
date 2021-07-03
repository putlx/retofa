function reToDFA(ast) {
    let [nfaStarts, nfaEnds, nfa] = reToEpsilonNFA(ast);

    function epsilonClosure(src, set) {
        const edges = nfa.get(src);
        if (edges) {
            for (const dst of edges.get("") || []) {
                if (!set.has(dst)) {
                    set.add(dst);
                    epsilonClosure(dst, set);
                }
            }
        }
    }

    epsilonClosure(nfaStarts[Symbol.iterator]().next().value, nfaStarts);
    const key = Date.now().toString().slice(3);
    const unresolved = [nfaStarts];
    const dfa = new Map();
    const starts = new Set([[...nfaStarts].sort().join(key)]);
    const ends = new Set();
    const notEnds = new Set();

    while (unresolved.length) {
        const srcs = unresolved.pop();
        const start = [...srcs].sort().join(key);
        if (!ends.has(start))
            notEnds.add(start);
        const edges = new Map();
        dfa.set(start, edges);
        for (const src of srcs) {
            for (const [symbol, nfaDsts] of nfa.get(src) || []) {
                if (symbol !== "") {
                    let dsts = edges.get(symbol);
                    if (!dsts)
                        edges.set(symbol, dsts = new Set());
                    for (const nfaDst of nfaDsts) {
                        dsts.add(nfaDst);
                        epsilonClosure(nfaDst, dsts);
                    }
                }
            }
            if (nfaEnds.has(src)) {
                ends.add(start);
                notEnds.delete(start);
            }
        }
        if (edges.size)
            for (const dsts of edges.values()) {
                const end = [...dsts].sort().join(key);
                if (!dfa.has(end))
                    unresolved.push(dsts);
                if (!ends.has(end))
                    notEnds.add(end);
            }
        else
            dfa.delete(start);
    }

    for (const edges of dfa.values())
        for (const [symbol, dsts] of [...edges])
            edges.set(symbol, [...dsts].sort().join(key));

    const groups = [new Set(ends), notEnds];

    function findGroup(state) {
        for (const group of groups)
            if (group.has(state))
                return group;
    }

    while ((function () {
        for (const group of groups) {
            if (group.size > 1) {
                let separated = false;
                const base = group[Symbol.iterator]().next().value;
                const baseEdges = dfa.get(base);
                for (const [symbol, dst] of baseEdges || []) {
                    const self = findGroup(dst);
                    const other = new Set();
                    for (const state of group) {
                        if (state !== base) {
                            let group;
                            const edges = dfa.get(state);
                            if (edges && edges.size === baseEdges.size) {
                                const dst = edges.get(symbol);
                                if (dst)
                                    group = findGroup(dst)
                            }
                            if (group !== self)
                                other.add(state);
                        }
                    }
                    if (other.size) {
                        for (const state of other)
                            group.delete(state);
                        groups.push(other);
                        separated = true;
                    }
                }
                if (separated) return true;
            }
        }
        return false;
    })());

    for (const edges of dfa.values())
        for (const [symbol, dst] of [...edges])
            edges.set(symbol, new Set([dst]));

    for (const group of groups) {
        if (group.size > 1) {
            const states = group[Symbol.iterator]();
            const base = states.next().value;
            const baseEdges = dfa.get(base);
            for (const state of states) {
                for (const [symbol, dsts] of dfa.get(state) || []) {
                    const baseDsts = baseEdges.get(symbol);
                    for (const dst of dsts)
                        baseDsts.add(dst);
                }
                dfa.delete(state);
                for (const edges of dfa.values())
                    for (const dsts of edges.values())
                        if (dsts.delete(state))
                            dsts.add(base);
                if (ends.delete(state))
                    ends.add(base);
            }
        }
    }

    return [starts, ends, dfa];
}
