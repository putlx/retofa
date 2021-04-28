"use strict";

let graph = null;

function draw(reToFa) {
    document.getElementById("msg").innerHTML = "";
    let re = document.getElementById("re").value.trim();
    if (!re.length)
        return;
    let takeSingleCharAsToken = document.getElementById("sc").checked;
    let starts, ends, nfa;
    try {
        [starts, ends, nfa] = reToFa(parse(tokensOf(re, takeSingleCharAsToken)));
    } catch (error) {
        document.getElementById("msg").innerHTML = error.message;
        console.log(error);
        return;
    }

    let states = new Set();
    let dot = "digraph{graph[pad=.3];edge[arrowsize=.6];node[style=filled];";
    for (let [start, ways] of nfa) {
        if (!starts.has(start) && !ends.has(start))
            states.add(start);
        for (let [symbol, es] of ways) {
            for (let e of es) {
                if (!starts.has(e) && !ends.has(e))
                    states.add(e);
                dot += `${start}->${e}[label=" ${symbol.replace("\"", "\\\"")}"];`
            }
        }
    }
    for (let start of starts)
        if (!ends.has(start))
            dot += `${start}[label="Start",fillcolor="#8ce99a"];`
        else
            dot += `${start}[label="Start & End",fillcolor="#74c0fc"];`
    for (let end of ends)
        if (!starts.has(end))
            dot += `${end}[label="End",fillcolor="#ffa8a8"];`
    for (let state of states)
        dot += `${state}[shape=circle,label="",fixedsize=true,width=.15,fillcolor="#ffe066"];`
    dot += "}";

    if (graph)
        graph.innerHTML = "";
    else
        graph = document.getElementById("graph");
    new Viz()
        .renderSVGElement(dot)
        .then(element => {
            graph.appendChild(element);
        })
        .catch(error => {
            document.getElementById("msg").innerHTML = error.message;
            console.log(error);
        });
}

window.addEventListener("load", function () {
    document.getElementById("re").value = "(''|pos|neg)(digit+(''|dot digit*)|digit* dot digit+)";
    draw(reToDfa);
}, { once: true });
