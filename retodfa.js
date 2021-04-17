function reToDfa(ast) {
    let [nfaStarts, nfaEnds, nfa] = reToEpsilonNfa(ast);

    function findEpsilon(start, dst) {
        let ways = nfa.get(start);
        if (ways) {
            for (let end of ways.get("") || []) {
                if (!dst.has(end)) {
                    dst.add(end);
                    findEpsilon(end, dst);
                }
            }
        }
    }

    findEpsilon(nfaStarts[Symbol.iterator]().next().value, nfaStarts);
    let key = Date.now().toString().slice(3);
    let unresolved = [nfaStarts];
    let dfa = new Map();
    let starts = new Set([[...nfaStarts].sort().join(key)]);
    let ends = new Set();
    let notEnds = new Set();

    while (unresolved.length) {
        let starts = unresolved.pop();
        let startState = [...starts].sort().join(key);
        if (!ends.has(startState))
            notEnds.add(startState);
        let ways = new Map();
        dfa.set(startState, ways);
        for (let start of starts) {
            for (let [symbol, nfaEnds] of nfa.get(start) || []) {
                if (symbol !== "") {
                    let ends = ways.get(symbol);
                    if (!ends)
                        ways.set(symbol, ends = new Set());
                    for (let end of nfaEnds) {
                        ends.add(end);
                        findEpsilon(end, ends);
                    }
                }
            }
            if (nfaEnds.has(start)) {
                ends.add(startState);
                notEnds.delete(startState);
            }
        }
        if (ways.size)
            for (let es of ways.values()) {
                let endState = [...es].sort().join(key);
                if (!dfa.has(endState))
                    unresolved.push(es);
                if (!ends.has(endState))
                    notEnds.add(endState);
            }
        else
            dfa.delete(startState);
    }

    for (let ways of dfa.values())
        for (let [symbol, ends] of [...ways])
            ways.set(symbol, [...ends].sort().join(key));

    let stateGroups = [new Set(ends), notEnds];

    function getGroup(state) {
        for (let stateGroup of stateGroups)
            if (stateGroup.has(state))
                return stateGroup;
    }

    while ((function () {
        for (let stateGroup of stateGroups) {
            if (stateGroup.size > 1) {
                let base = stateGroup[Symbol.iterator]().next().value;
                let baseWays = dfa.get(base) || [];
                let separated = false;
                for (let [symbol, end] of baseWays) {
                    let thisGroup = getGroup(end);
                    let otherGroup = new Set();
                    for (let state of stateGroup) {
                        if (state !== base) {
                            let group;
                            let ways = dfa.get(state);
                            if (ways && ways.size === baseWays.size) {
                                let end = ways.get(symbol);
                                if (end)
                                    group = getGroup(end);
                            }
                            if (group !== thisGroup)
                                otherGroup.add(state);
                        }
                    }
                    if (otherGroup.size) {
                        for (let state of otherGroup)
                            stateGroup.delete(state);
                        stateGroups.push(otherGroup);
                        separated = true;
                    }
                }
                if (separated) return true;
            }
        }
        return false;
    })());

    for (let ways of dfa.values())
        for (let [symbol, end] of [...ways])
            ways.set(symbol, new Set([end]));

    for (let stateGroup of stateGroups) {
        if (stateGroup.size > 1) {
            let states = stateGroup[Symbol.iterator]();
            let dst = states.next().value;
            let ways = dfa.get(dst);
            for (let state of states) {
                for (let [symbol, ends] of dfa.get(state) || []) {
                    let endsDst = ways.get(symbol);
                    for (let end of ends)
                        endsDst.add(end);
                }
                dfa.delete(state);
                for (let ways of dfa.values())
                    for (let ends of ways.values())
                        if (ends.delete(state))
                            ends.add(dst);
                if (ends.delete(state))
                    ends.add(dst);
            }
        }
    }

    return [starts, ends, dfa];
}
