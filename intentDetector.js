module.exports = function wantsHuman(text = "") {

    const t = text.toLowerCase().trim();

    // հիմնական բառեր
    const keywords = [
        "մենեջեր","մենեջեռ","օպերատոր","մարդու հետ","զանգ","զանգեք",
        "կապվեք","կապվի","զանգահար","զանգեմ","զանգել","զանգահարեք",
        "call","manager","human","operator","contact me","phone call",
        "оператор","менеджер","позвон","свяжитесь","перезвон"
    ];

    // կարճ հաղորդագրություններ ավելի մեծ հավանականություն ունեն
    if (t.length < 25 && keywords.some(k => t.includes(k)))
        return true;

    // հատուկ արտահայտություններ
    const phrases = [
        "կարող եք զանգել",
        "ուզում եմ խոսել",
        "թող մեկը կապվի",
        "хочу поговорить",
        "can you call",
        "let me talk"
    ];

    if (phrases.some(p => t.includes(p)))
        return true;

    return false;
};
