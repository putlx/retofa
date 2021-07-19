function* tokensOf(re, takeSingleCharAsToken) {
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

function parse(tokens) {
    const symbols = [];
    const ops = [];

    function take(op) {
        if (op === "." || op === "|") {
            if (symbols.length < 2)
                throw new SyntaxError("Invalid syntax");
            symbols.push({ op: op, rhs: symbols.pop(), lhs: symbols.pop() });
        } else if (op === "*" || op === "+") {
            if (symbols.length < 1)
                throw new SyntaxError("Invalid syntax");
            symbols.push({ op: op, lhs: symbols.pop() });
        } else {
            throw new SyntaxError("Unclosed parenthesis");
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
        } else { // token === "." || token === "|"
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
