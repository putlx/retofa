function* parse(re, takeSingleCharAsToken) {
    while ((re = re.trimStart()).length) {
        if ("().+*|".includes(re[0])) {
            yield [re[0], false];
            re = re.slice(1);
        } else if ("\"'".includes(re[0])) {
            let token = "";
            let i = 1;
            for (let quote = re[0]; i < re.length && re[i] !== quote; ++i) {
                if (re[i] === "\\") {
                    if (++i === re.length)
                        throw new SyntaxError("Invalid ending: \\");
                    token += JSON.parse(`"\\${re[i]}"`);
                } else
                    token += re[i];
            }
            if (i === re.length)
                throw new SyntaxError("Unclosed quote");
            yield [token, true];
            re = re.slice(i + 1);
        } else if (takeSingleCharAsToken) {
            if (!re[0].match(/[\w\-]/))
                throw new SyntaxError(`Invalid token: ${re[0]}`);
            yield [re[0], true];
            re = re.slice(1);
        } else {
            let token = "";
            let i = 0;
            while (i < re.length && re[i].match(/[\w\-]/))
                token += re[i++];
            if (i === 0)
                throw new SyntaxError(`Invalid token: ${re[0]}`);
            yield [token, true];
            re = re.slice(i);
        }
    }
}

function makeAst(tokens) {
    let symbols = [];
    let ops = [];

    function take(op) {
        if (op === "." || op === "|") {
            if (symbols.length < 2)
                throw new SyntaxError("Invalid syntax");
            symbols.push({ op: op, rhs: symbols.pop(), lhs: symbols.pop() });
        } else {
            if (symbols.length < 1)
                throw new SyntaxError("Invalid syntax");
            symbols.push({ op: op, lhs: symbols.pop() });
        }
    }

    let prev = null;
    for (let [token, isSymbol] of tokens) {
        if (isSymbol) {
            if (prev && !"(.|".includes(prev))
                ops.push(".");
            symbols.push({ symbol: token });
            token = " ";
        } else if (token === "(") {
            if (prev && !"(.|".includes(prev))
                ops.push(".");
            ops.push(token);
        } else if (token === ")") {
            while (true) {
                if (!ops.length) {
                    throw new SyntaxError("Invalid syntax");
                } else if (ops[ops.length - 1] === "(") {
                    ops.pop();
                    break;
                }
                take(ops.pop());
            }
        } else if (token === "*" || token === "+") {
            take(token);
        } else {
            while (ops.length && (ops[ops.length - 1] === "." || ops[ops.length - 1] === token))
                take(ops.pop());
            ops.push(token);
        }
        prev = token;
    }

    while (ops.length)
        take(ops.pop());
    if (symbols.length !== 1)
        throw new SyntaxError("Invalid syntax");
    return symbols.pop();
}

function reToEpsilonNfa(re, takeSingleCharAsToken) {
    let tokens = parse(re, takeSingleCharAsToken);
    let ast = makeAst(tokens);

    let nfa = new Map();
    let state = 0;
    let start = state++;
    let end = state++;

    function insert(start, symbol, end) {
        if (!nfa.has(start))
            nfa.set(start, new Map());
        if (!nfa.get(start).has(symbol))
            nfa.get(start).set(symbol, new Set());
        nfa.get(start).get(symbol).add(end);
    }

    (function makeNfa(ast, start, end) {
        if (!ast.op) {
            insert(start, ast.symbol, end);
        } else if (ast.op === ".") {
            let mid = state++;
            makeNfa(ast.lhs, start, mid);
            makeNfa(ast.rhs, mid, end);
        } else if (ast.op == "|") {
            makeNfa(ast.lhs, start, end);
            makeNfa(ast.rhs, start, end);
        } else if (ast.op == "*") {
            let mid = state++;
            insert(start, "", mid);
            insert(mid, "", end);
            makeNfa(ast.lhs, mid, mid);
        } else if (ast.op == "+") {
            let rhs = { op: "*", lhs: ast.lhs };
            let lhs = { op: ".", lhs: ast.lhs, rhs: rhs };
            makeNfa(lhs, start, end);
        } else
            throw new SyntaxError("Invalid operator");
    })(ast, start, end);

    return [new Set([start]), new Set([end]), nfa];
}

function reToNfa(re, takeSingleCharAsToken) {
    let [starts, ends, nfa] = reToEpsilonNfa(re, takeSingleCharAsToken);

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
            for (let [_, ways] of nfa)
                for (let [_, ends] of ways)
                    ends.delete(s);
        }
    }

    return [starts, ends, nfa];
}
