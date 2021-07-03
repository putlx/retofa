function reToEpsilonNFA(ast) {
    let state = 0;
    const nfa = new Map();
    const start = state++;
    const end = state++;

    function insert(src, symbol, dst) {
        let edges = nfa.get(src);
        if (!edges)
            nfa.set(src, edges = new Map());
        let dsts = edges.get(symbol);
        if (!dsts)
            edges.set(symbol, dsts = new Set());
        dsts.add(dst);
    }

    (function makeNFA(ast, src, dst) {
        if (!ast.op) {
            insert(src, ast.symbol, dst);
        } else if (ast.op === ".") {
            const mid = state++;
            makeNFA(ast.lhs, src, mid);
            makeNFA(ast.rhs, mid, dst);
        } else if (ast.op === "|") {
            makeNFA(ast.lhs, src, dst);
            makeNFA(ast.rhs, src, dst);
        } else if (ast.op === "*") {
            const mid = state++;
            insert(src, "", mid);
            insert(mid, "", dst);
            makeNFA(ast.lhs, mid, mid);
        } else { // ast.op === "+"
            const rhs = { op: "*", lhs: ast.lhs };
            const lhs = { op: ".", lhs: ast.lhs, rhs: rhs };
            makeNFA(lhs, src, dst);
        }
    })(ast, start, end);

    return [new Set([start]), new Set([end]), nfa];
}

function reToNFA(ast) {
    const [starts, ends, nfa] = reToEpsilonNFA(ast);

    function extractEpsilonEdge() {
        for (const [src, edges] of nfa) {
            const dsts = edges.get("");
            if (dsts && dsts.size) {
                const dst = dsts[Symbol.iterator]().next().value;
                dsts.delete(dst);
                if (!dsts.size)
                    edges.delete("");
                if (!edges.size)
                    nfa.delete(src);
                return [src, dst];
            }
        }
    }

    for (let edge; edge = extractEpsilonEdge();) {
        const [eSrc, eDst] = edge;
        for (const [src, edges] of nfa)
            for (const [symbol, dsts] of edges)
                if (!(src === eDst && symbol === "") && dsts.has(eSrc))
                    dsts.add(eDst);
        if (starts.has(eSrc))
            starts.add(eDst);
        if (!nfa.has(eSrc) && !ends.has(eSrc)) {
            starts.delete(eSrc);
            for (const edges of nfa.values())
                for (const dsts of edges.values())
                    dsts.delete(eSrc);
        }
    }

    return [starts, ends, nfa];
}
