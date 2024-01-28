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
    ctx.sessionId = localSession.getSessionKey(ctx);
    await next();
    console.timeEnd(title);
}

async function onMessageHandler(ctx) {
    const command = ctx?.message?.text
    if(!command) {
        return
    }
    if (command === 'e') {
        const currentTimer = await TogglTrackAPI.currentTimer();
        if (!currentTimer) {
            return await ctx.sendMessage(`No active timer`);
        }
        const stoppedTimeEntry = await TogglTrackAPI.stopTracking(currentTimer, new Date(ctx.message.date * 1000).toISOString());
        return await ctx.sendMessage(`Stopped time entry ${JSON.stringify(stoppedTimeEntry)}`);
    }
    if (command === 'd') {
        const currentTimer = await TogglTrackAPI.currentTimer();
        if (!currentTimer) {
            return await ctx.sendMessage(`No active timer`);
        }
        await TogglTrackAPI.discardTracking(currentTimer);
        return await ctx.sendMessage(`Discarded time entry`);
    }
    if (command === 's') {
        if(!ctx.session.pid) {
            return await ctx.sendMessage('pid not set');
        }
        const currentTimer = await TogglTrackAPI.currentTimer();
        if (currentTimer) {
            return await ctx.sendMessage(`Timer already running: ${JSON.stringify(currentTimer)}`);
        }
        const timeEntry = await TogglTrackAPI.startTracking({
            pid: Number(ctx.session.pid),
            start: new Date(ctx.message.date * 1000).toISOString()
        });
        return await ctx.sendMessage(`Started time entry ${JSON.stringify(timeEntry)}`);
    }
    if (command === 'p') {
        const projects = await TogglTrackAPI.projectsString()
        return await ctx.sendMessage(projects, { parse_mode: 'Markdown' });
    }
    if (command.startsWith('p')) {
        const pid = command.slice(1)
        const project = await TogglTrackAPI.project(pid)
        if(project) {
            ctx.session.pid = pid
            return await ctx.sendMessage(project.name + ' is set');
        } else {
            return await ctx.sendMessage('invalid id');
        }
    }
    return await ctx.sendMessage('unknown command');
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
