/*
    Gamemaker: Studio 1.x/2 Socket.io extension 
    Author: Ignas Kavaliauskas
    https://github.com/IgnasKavaliauskas/SocketIO-GMS2-Extension
*/

const server = require('http').createServer()
const io = require('socket.io')(server)
const port = 3000;

// Listen for incoming connections
server.listen(port, (err) => {
    if (err) throw err
    console.log(`Listening on port ${port}`);
});

var players = []; // all connected players will be stored here
var units = [];
var clientId = 0; // unique ID for every client
var unitId = 0;


class Player {
    constructor(data) {
        this.username = data.username;
        this.socket = data.socket;
        this.id = data.id;

        this.x = data.x;
        this.y = data.y;
        this.animation = null;
        this.x_scale = 1;

        this.gold = 0;
        this.fame = 0;
    }

    toString() {
        return JSON.stringify(this, this.replacer);
    }

    replacer(key, value) {
        // we don't need to send the socket object to the client
        if (key == "socket") return undefined;
        else return value;
    }
}

class Unit {
    constructor(data) {
        this.socket = data.socket;
        this.playerId = data.playerId;
        this.unitId = data.unitId;

        this.x = data.x;
        this.y = data.y;

    }

    toString() {
        return JSON.stringify(this, this.replacer);
    }

    replacer(key, value) {
        // we don't need to send the socket object to the client
        if (key == "socket") return undefined;
        else return value;
    }
}

io.on('connection', (client) => {
    var playerId = clientId++;
    var player;

    // This event will be trigered when the client request to join the game. 
    // In this example project, it'll happen after you've entered your username on the client side
    client.on('create_player', (data) => {
        data = JSON.parse(data);

        player = new Player({
            socket: client,
            id: playerId,
            username: data.username,
            x: Math.floor(Math.random() * 700) + 60,
            y: Math.floor(Math.random() * 500) + 60
        });

        // Add to players list
        players.push(player);

        // Creating ourself, just ourself!
        client.emit('create_player', player.toString());

        // Creating ourself for everyone else, ourself NOT included
        client.broadcast.emit('create_player_other', player.toString());


        //
        //  OTHER SCENE SETUP - PULL OTHER CONTENTS
        //

        // Creating everyone else for ourself, ourself NOT included because we already created ourself
        for (let i in players) {
            if (players[i] !== player) {
                client.emit('create_player_other', players[i].toString());
            }
        }

        for (let i in units) {

            client.emit('create_unit', units[i].toString());
            
        }

        console.log(`Player "${player.username}", with ID: ${player.id} created!`);
    });

    // Broadcast our position to all players, ourself NOT included
    // This is just an example project, we don't care if the client cheats. But you might consider also sending your own position to yourself for security/sync reasons
    // it depends on your project, e.g. if player position is important on client side
    client.on('position_update', (data) => {
        data = JSON.parse(data);

        player.x = data.x;
        player.y = data.y;

        client.broadcast.emit('position_update', player.toString());
    });

    client.on('unit_position_update', (data) => {
        data = JSON.parse(data);

        for (let i in units) {
            if(units[i].unitId == data.unitId) {
                units[i].x = data.x;
                units[i].y = data.y;

                client.broadcast.emit('unit_position_update', units[i].toString());
                break;
            }
        }

        
    });

    client.on('animation_update', (data) => {
        data = JSON.parse(data);

        if(player) {
        player.animation = data.animation;
        player.x_scale = data.x_scale;

        client.broadcast.emit('animation_update', player.toString());
        }
    });

    client.on('create_unit', (data) => {
        data = JSON.parse(data);

        unit = new Unit({
            socket: client,
            playerId: playerId,
            unitId: unitId++,
            x: data.x,
            y: data.y
        });

        units.push(unit);

        client.emit('create_unit', unit.toString());
        client.broadcast.emit('create_unit', unit.toString());

        console.log(`Unit ${unit.unitId} belonging to player ${unit.playerId} created`);
    });

    // When a player closes the game or refresh the page, this event will be triggered
    client.on('disconnect', () => {

        //Remove player's units
        for (let i in units) {
            //console.log("unit playerId: ", units[i].playerId);
            if(units[i].playerId == playerId) {

                client.broadcast.emit('destroy_unit', units[i].toString());

                units.splice(i, 1);
                console.log("unit spliced");
            }
        }

        // Tell everyone that we disconnected (ourself NOT included, because we already closed the game and we don't care)
        client.broadcast.emit('destroy_player', player.toString());

        //Remove player from list
        players.splice(players.indexOf(player), 1);

        console.log(`Player "${player.username}", with ID: ${player.id} disconnected.`);
    });
});