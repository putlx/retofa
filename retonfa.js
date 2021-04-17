function reToEpsilonNfa(ast) {
    let nfa = new Map();
    let state = 0;
    let start = state++;
    let end = state++;

    function insert(start, symbol, end) {
        let ways = nfa.get(start);
        if (!ways)
            nfa.set(start, ways = new Map());
        let ends = ways.get(symbol);
        if (!ends)
            ways.set(symbol, ends = new Set());
        ends.add(end);
    }

    (function makeNfa(ast, start, end) {
        if (!ast.op) {
            insert(start, ast.symbol, end);
        } else if (ast.op === ".") {
            let mid = state++;
            makeNfa(ast.lhs, start, mid);
            makeNfa(ast.rhs, mid, end);
        } else if (ast.op === "|") {
            makeNfa(ast.lhs, start, end);
            makeNfa(ast.rhs, start, end);
        } else if (ast.op === "*") {
            let mid = state++;
            insert(start, "", mid);
            insert(mid, "", end);
            makeNfa(ast.lhs, mid, mid);
        } else { // ast.op === "+"
            let rhs = { op: "*", lhs: ast.lhs };
            let lhs = { op: ".", lhs: ast.lhs, rhs: rhs };
            makeNfa(lhs, start, end);
        }
    })(ast, start, end);

    return [new Set([start]), new Set([end]), nfa];
}

function reToNfa(ast) {
    let [starts, ends, nfa] = reToEpsilonNfa(ast);

    function extract_epsilon() {
        for (let [start, ways] of nfa) {
            let ends = ways.get("");
            if (ends && ends.size) {
                let end = ends[Symbol.iterator]().next().value;
                ends.delete(end);
                if (!ends.size)
                    ways.delete("");
                if (!ways.size)
                    nfa.delete(start);
                return [start, end];
            }
        }
    }

    for (let way; way = extract_epsilon();) {
        let [s, e] = way;
        for (let [start, ways] of nfa)
            for (let [symbol, ends] of ways)
                if (!(start === e && symbol === "") && ends.has(s))
                    ends.add(e);
        if (starts.has(s))
            starts.add(e);
        if (!nfa.has(s) && !ends.has(s)) {
            starts.delete(s);
            for (let ways of nfa.values())
                for (let ends of ways.values())
                    ends.delete(s);
        }
    }

    return [starts, ends, nfa];
}
