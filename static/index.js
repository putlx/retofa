"use strict";

import { default as init, Parser, EpsilonNFA, NFA, DFA } from "./retofa.min.js";

async function render(FA) {
    const textarea = document.querySelector("#re");
    textarea.classList.remove("is-invalid");
    const re = textarea.value.trim();
    const single_char_token = document.querySelector("#single-char-token").checked;
    try {
        const ast = new Parser().parse(re, single_char_token);
        const dot = new FA(ast).toDot();
        console.log(dot);
        const element = await new Viz().renderSVGElement(dot);
        const graph = document.querySelector("#graph");
        graph.innerHTML = "";
        graph.appendChild(element);
    } catch (error) {
        console.log(error);
        document.querySelector("#msg").innerHTML = error.message;
        textarea.classList.add("is-invalid");
    }
}

window.addEventListener("load", async function () {
    await init();
    const buttons = document.body.querySelectorAll("button");
    buttons[0].onclick = async () => await render(EpsilonNFA);
    buttons[1].onclick = async () => await render(NFA);
    buttons[2].onclick = async () => await render(DFA);
    document.querySelector("#re").value = `('+'|'-')?(digit+(dot digit*)?|digit* dot digit+)`;
    await render(DFA);
});
