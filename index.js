let graph = null;

function draw(func) {
    document.getElementById("msg").innerHTML = "";
    let re = document.getElementById("re").value.trim();
    if (!re.length)
        return;
    let takeSingleCharAsToken = document.getElementById("sc").checked;
    let starts, end, nfa;
    try {
        [starts, end, nfa] = func(re, takeSingleCharAsToken);
    } catch (error) {
        document.getElementById("msg").innerHTML = error.message;
        console.log(error);
        return;
    }

    let states = new Set();
    let dot = "digraph{";
    for (let [start, ways] of nfa) {
        if (!starts.has(start) && start !== end)
            states.add(start);
        for (let [symbol, ends] of ways) {
            for (let e of ends) {
                if (!starts.has(e) && e !== end)
                    states.add(e);
                dot += `${start}->${e}[label=" ${symbol.replace("\"", "\\\"")}",arrowsize=.6];`
            }
        }
    }
    let endIsStart = false;
    for (let start of starts)
        if (start !== end)
            dot += `${start}[label="Start",style=filled,fillcolor="#69db7c"];`
        else
            endIsStart = true;
    if (endIsStart)
        dot += `${end}[label="Start & End",style=filled,fillcolor="#4dabf7"]`
    else
        dot += `${end}[label="End",style=filled,fillcolor="#ff8787"]`
    for (let state of states)
        dot += `${state}[shape=circle,label="",fixedsize=true,width=.15,style=filled,fillcolor="#ffd43b"];`
    dot += "}";

    if (graph)
        graph.innerHTML = "";
    else
        graph = document.getElementById("graph");
    new Viz()
        .renderSVGElement(dot)
        .then(element => {
            graph.appendChild(element);
            graph.appendChild(document.createElement("br"));
            graph.appendChild(document.createElement("br"));
        })
        .catch(error => {
            document.getElementById("msg").innerHTML = error.message;
            console.log(error);
        });
}

window.addEventListener("load", function () {
    document.getElementById("re").value = "(''|pos|neg)(digit+(''|dot digit*)|digit* dot digit+)";
    draw(reToNfa);
}, { once: true });
