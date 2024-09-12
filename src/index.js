// noinspection SqlNoDataSourceInspection

require("log-timestamp");

const dotenv = require("dotenv");

const {Telegraf, Markup} = require("telegraf");
const {message} = require("telegraf/filters");

const LocalSession = require("telegraf-session-local");

const TogglTrackAPI = require("./toggl_track_api");

dotenv.config();

const settings = {
    botToken: process.env.BOT_TOKEN,
    databasePath: "data/sessions.json",
};
if (!settings.botToken) {
    throw new Error("env.BOT_TOKEN is not set");
}

const localSession = new LocalSession({
    storage: LocalSession.storageFileAsync,
    database: settings.databasePath,
});


async function setup(ctx, next) {
    const update = ctx.update;
    const message = update.message;
    let action = message ? `text:${message.text}` : null;
    action ??= "<empty>";
    action = action.slice(0, 30);
    const fromId = message?.from.id || "-";
    const fromUsername = message?.from.username || "-";
    const title = `Processing update [${ctx.update.update_id}] from [${fromId} @${fromUsername}] with text "${action}"`;
    console.time(title);
    ctx.session = ctx.session ?? {}
    ctx.session.dates = ctx.session.dates ?? []
    ctx.sessionId = localSession.getSessionKey(ctx);
    await next();
    console.timeEnd(title);
}

async function onMessageHandler(ctx) {
    if(ctx.message?.forward_origin?.date) {
        ctx.session.dates.push(ctx.message.forward_origin.date)
    }
    const command = ctx?.message?.text
    if(!command) {
        return
    }
    if(command === 'c') {
        ctx.session.dates = []
        return
    }
    if(command === 'send')
    ctx.sendMessage(JSON.stringify(ctx.session.dates))
    if(ctx.session.dates.length % 2 === 0) {
        const totalTime = ctx.session.dates.slice().sort().reduce((a,c,i) => a + (i%2===0?(-1):1)* c,0)
        const hours = Math.floor(totalTime / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalTime % 3600) / 60).toString().padStart(2, '0');
        const seconds = (totalTime % 60).toString().padStart(2, '0');
        ctx.sendMessage(`${totalTime} ${hours}:${minutes}:${seconds}`)
    } else {
        ctx.sendMessage("Something went wrong... ctx.session.dates.length % 2 !== 0")
    }
}

async function catchErrorHandler(err, ctx) {
    const message = String(err?.response?.data || err)
    await ctx.sendMessage("Error: " + message);
}

const bot = new Telegraf(settings.botToken);

bot.use(localSession.middleware());
bot.use(setup);

bot.on(message(), onMessageHandler);

bot.catch(catchErrorHandler);

// noinspection JSIgnoredPromiseFromCall
bot.launch({
    allowedUpdates: ["message"],
});

// Enable graceful stop
function gracefullyStop(signal) {
    return function () {
        bot.stop(signal);
    };
}

for (const signal of ["SIGINT", "SIGQUIT", "SIGTERM"]) {
    process.once(signal, gracefullyStop(signal));
}
