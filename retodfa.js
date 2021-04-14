function reToDfa(re, takeSingleCharAsToken) {
    let [nfaStarts, nfaEnds, nfa] = reToEpsilonNfa(re, takeSingleCharAsToken);

    function findEpsilon(start, dst) {
        let ways = nfa.get(start);
        if (ways) {
            let ends = ways.get("");
            if (ends) {
                for (let end of ends) {
                    if (!dst.has(end)) {
                        dst.add(end);
                        findEpsilon(end, dst);
                    }
                }
            }
        }
    }

    findEpsilon(nfaStarts[Symbol.iterator]().next().value, nfaStarts);
    let key = Date.now().toString();
    let unresolved = new Set([nfaStarts]);
    let dfa = new Map();
    let starts = new Set([[...nfaStarts].sort().join(key)]);
    let ends = new Set();

    while (unresolved.size) {
        let starts = unresolved[Symbol.iterator]().next().value;
        unresolved.delete(starts);
        let startState = [...starts].sort().join(key);
        let ways = new Map();
        dfa.set(startState, ways);
        for (let start of starts) {
            let nfaWays = nfa.get(start);
            if (nfaWays) {
                for (let [symbol, nfaEnds] of nfaWays) {
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
            }
            if (nfaEnds.has(start))
                ends.add(startState);
        }
        for (let ends of ways.values()) {
            let endState = [...ends].sort().join(key);
            if (!dfa.has(endState))
                unresolved.add(ends);
        }
    }

    for (let ways of dfa.values())
        for (let symbol of [...ways.keys()])
            ways.set(symbol, new Set([[...ways.get(symbol)].sort().join(key)]));

    return [starts, ends, dfa];
}
