const { Client } = require("discord.js");
const { Manager } = require("erela.js");
const { token, nodes } = require("./config");

const client = new Client({
    intents: [129]
})

client.on("ready", () => {
    console.log("I am ready")
    client.manager.init(client.user.id);
    client.application.commands.set([
        {
            name: "play",
            description: "คำสั่งเล่นเพลง",
            options: [{
                name: "url",
                description: "ลิ้งค์เพลง",
                type: "STRING",
                required: true
            }]
        }
    ])
})

client.on("raw", d => client.manager.updateVoiceState(d));

client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) return;

    if (interaction.isCommand()) {
        const namecmd = interaction.commandName;
        if (namecmd === "play") {
            const url = interaction.options.getString("url");

            let res;
            try {
                // Search for tracks using a query or url, using a query searches youtube automatically and the track requester object
                res = await client.manager.search(url, interaction.user);
                // Check the load type as this command is not that advanced for basics
                if (res.loadType === "LOAD_FAILED") throw res.exception;
                else if (res.loadType === "PLAYLIST_LOADED") throw { message: "Playlists are not supported with this command." };
            } catch (err) {
                return interaction.reply(`there was an error while searching: ${err.message}`);
            }

            const player = client.manager.create({
                guild: interaction.guildId,
                voiceChannel: interaction.member.voice.channel.id,
                textChannel: interaction.channel.id,
            });

            player.connect();
            player.queue.add(res.tracks[0]);

            if (!player.playing && !player.paused && !player.queue.size) player.play()

            return interaction.reply(`enqueuing ${res.tracks[0].title}.`)
        }
    }
})

client.manager = new Manager({
    // The nodes to connect to, optional if using default lavalink options
    nodes,
    // Method to send voice data to Discord
    send: (id, payload) => {
        const guild = client.guilds.cache.get(id);
        // NOTE: FOR ERIS YOU NEED JSON.stringify() THE PAYLOAD
        if (guild) guild.shard.send(payload);
    }
});

client.manager.on("nodeConnect", node => {
    console.log(`Node "${node.options.identifier}" connected.`)
})

client.manager.on("trackStart", (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    // Send a message when the track starts playing with the track name and the requester's Discord tag, e.g. username#discriminator
    channel.send(`Now playing: \`${track.title}\`, requested by \`${track.requester.tag}\`.`);
});

client.manager.on("queueEnd", player => {
    const channel = client.channels.cache.get(player.textChannel);
    channel.send("Queue has ended.");
    player.destroy();
});

client.login(token)