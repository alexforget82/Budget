import { $, todayView } from "./view.js";
const { simulation } = await (await fetch("/demo.json")).json();
const descriptions = {
  laine:
    "01 — Laine et sapin. Fond crème, vert profond, espace et contraste. La direction principale proposée.",
  slate:
    "02 — Ardoise et menthe. Une ambiance sombre, des montants lumineux et les mêmes trois repères.",
  paper:
    "03 — Papier et encre. Une présentation plus compacte, proche d’un registre, avec un bleu discret.",
};
function draw() {
  const mode = $("#direction").value;
  document.documentElement.dataset.direction = mode;
  document.body.dataset.mock = mode;
  $("#description").textContent = descriptions[mode];
  $("#preview").replaceChildren(todayView(simulation));
  history.replaceState(null, "", "?direction=" + mode);
}
const query = new URLSearchParams(location.search).get("direction");
if (descriptions[query]) $("#direction").value = query;
$("#direction").onchange = draw;
draw();
