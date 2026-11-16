// Her side of couple mode (lazy): the engine with Eitan's answers folded in, and his chips for her result screen.
import { makeQuiz } from "./quiz.js";
import { applyHis, hisChips } from "../../engine/couple.js";
import { COUPLE } from "../../data/strings-couple.js";

export const coupleQuiz = (his, room, history, weather) => applyHis(makeQuiz(room, history, { weather }), his);
export const chipsFor = (his) => hisChips(his, COUPLE);
export const byLine = (me) => COUPLE.by(me);
