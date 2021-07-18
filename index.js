"use strict";

function draw(reToFA) {
    const textarea = document.getElementById("re");
    textarea.classList.remove("is-invalid");
    const re = textarea.value.trim();
    const sc = document.getElementById("sc").checked;
    if (!re.length) return;
    try {
        const [starts, ends, fa] = reToFA(parse(tokensOf(re, sc)));
        const states = new Set();
        let dot = "digraph{graph[pad=.3];edge[arrowsize=.6];node[style=filled];";
        for (const [src, edges] of fa) {
            if (!starts.has(src) && !ends.has(src))
                states.add(src);
            for (const [symbol, dsts] of edges) {
                for (const dst of dsts) {
                    if (!starts.has(dst) && !ends.has(dst))
                        states.add(dst);
                    dot += `${src}->${dst}[label=" ${symbol.replace("\"", "\\\"")}"];`
                }
            }
        }
        for (const start of starts)
            if (ends.has(start))
                dot += `${start}[label="Start & End",fillcolor="#74c0fc"];`
            else
                dot += `${start}[label="Start",fillcolor="#8ce99a"];`
        for (const end of ends)
            if (!starts.has(end))
                dot += `${end}[label="End",fillcolor="#ffa8a8"];`
        for (const state of states)
            dot += `${state}[shape=circle,label="",fixedsize=true,width=.15,fillcolor="#ffe066"];`
        dot += "}";

        new Viz()
            .renderSVGElement(dot)
            .then(element => {
                const graph = document.getElementById("graph");
                graph.innerHTML = "";
                graph.appendChild(element);
            })
            .catch(error => {
                document.getElementById("msg").innerHTML = error.message;
                console.log(error);
            });
    } catch (error) {
        document.getElementById("msg").innerHTML = error.message;
        console.log(error);
        textarea.classList.add("is-invalid");
    }
}

window.addEventListener("load", function () {
    document.getElementById("re").value = "(''|pos|neg)(digit+(''|dot digit*)|digit* dot digit+)";
    draw(reToDFA);
});
