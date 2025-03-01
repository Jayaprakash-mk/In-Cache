const logger = require("./utils/logger")("Redis")
const config = require("./config.json")
const snapshot = require("./persistence/snapshot")
const appendOnly = require("./persistence/appendOnly")

const {store, expirationTimes} = snapshot

const isExpired = (key) => expirationTimes[key] && expirationTimes[key] < Date.now()

const checkExpiry = (key) => {
    if(isExpired(key)){
        delete store[key]
        delete expirationTimes[key]
        return true
    }
    
    return false
}

const commandHandlers = {
    SET: (args) => {
        if(args.length < 2){
            return "-ERR Wrong number of arguments for `SET` command\r\n"
        }

        const [key,value] = args
        store[key] = {type: "string", value}
        
        return "+OK\r\n"
    },

    GET: (args) => {
        if(args.length < 1){
            return "-ERR Wrong number of arguments for `GET` command\r\n"
        }

        const [key] = args

        if(checkExpiry(key) || !store[key] || store[key].type !== "string"){
            return "#f\r\n"
        }

        const value = store[key].value
        return `$${value.length}\r\n${value}\r\n`
    },

    DEL: (args) => {
        if (args.length < 1){
            return "-ERR Wrong number of arguments for `DEL` command\r\n"
        }

        const [key] = args
        if(store[key]){
            delete store[key]
            delete expirationTimes[key]

            return ":1\r\n"
        }
        
        return ":0\r\n"
        
    },

    EXPIRE: (args) => {
        if(args.length < 2){
             return "-ERR Wrong number of arguments for `EXPIRE` command\r\n"
        }

        const [key, seconds] = args

        if(!store[key]) return "#f\r\n"

        expirationTimes[key] = Date.now() + (seconds * 1000)

        return "#t\r\n"
    },

    TTL: (args) => {
        if(args.length < 1){
            return "-ERR Wrong number of arguments for `TTL` command\r\n"
        }

        const [key] = args
        if(!store[key] || !expirationTimes[key]) return "#f\r\n"

        const ttlValue = Math.floor((expirationTimes[key] - Date.now()) / 1000)

        return ttlValue > 0 ? `:${ttlValue}\r\n` : `#f\r\n`
    },

    INCR: (args) => {
        if(args.length < 1){
            return "-ERR Wrong number of arguments for `INCR` command\r\n"
        }

        const key = args[0]
        let incValue;

        if(args.length === 2 && isNaN(parseInt(args[1],10))){
            return "-ERR increment argument is not an integer or out of range\r\n"
        }

        if(!store[key]){
            if(args.length === 1) incValue = "1"
            else if(args.length === 2) incValue = args[1]
            store[key] = {type: "string", value: incValue};

            return `:${parseInt(incValue, 10)}\r\n`
        }

        const value = parseInt(store[key].value, 10);
        
        if(isNaN(value)) return "-ERR value is not an integer or out of range\r\n"

        if(args.length === 1) incValue = value + 1;
        else if(args.length === 2) incValue = value + parseInt(args[1], 10);
        store[key].value = (incValue).toString()

        logger.debug(incValue)

        return `:${incValue}\r\n`

    },

    DECR: (args) => {
        if(args.length < 1){
            return "-ERR Wrong number of arguments for `DECR` command\r\n"
        }

        const key = args[0]
        let decValue;

        if(args.length === 2 && isNaN(parseInt(args[1],10))){
            return "-ERR increment argument is not an integer or out of range\r\n"
        }

        if(!store[key]){
            if(args.length === 1) decValue = "-1"
            else if(args.length === 2) decValue = ("-" + args[1])
            store[key] = {type: "string", value: decValue};

            return `:${parseInt(decValue, 10)}\r\n`
        }

        const value = parseInt(store[key].value, 10);
        
        if(isNaN(value)) return "-ERR value is not an integer or out of range\r\n"

        if(args.length === 1) decValue = value - 1;
        else if(args.length === 2) decValue = value - parseInt(args[1], 10);
        store[key].value = (decValue).toString()

        logger.debug(decValue)

        return `:${decValue}\r\n`

    },

    LPUSH: (args) => {
        if(args.length < 2){
            return "-ERR Wrong number of arguments for `LPUSH` command\r\n"
        }

        const [key, ...values] = args

        if(!store[key]){
            store[key] = {type: "list", value: []}
        }

        if(store[key].type !== "list"){
            return "-ERR Wrong type of key\r\n"
        }

        store[key].value.unshift(...values)

        return `:${store[key].value.length}\r\n`
    },

    RPUSH: (args) => {
        if(args.length < 2){
            return "-ERR Wrong number of arguments for `RPUSH` command\r\n"
        }

        const [key, ...values] = args

        if(!store[key]){
            store[key] = {type: "list", value: []}
        }

        if(store[key].type !== "list"){
            return "-ERR Wrong type of key\r\n"
        }

        store[key].value.push(...values)

        return `:${store[key].value.length}\r\n`
    },

    LPOP: (args) => {
        if(args.length < 1){
            return "-ERR Wrong number of arguments for `LPOP` command\r\n"
        }

        const [key] = args

        if(checkExpiry(key) || !store[key] || store[key].type !== "list" || store[key].value.length === 0){
            return "#f\r\n"
        }

        const value = store[key].value.shift()

        return `$${value.length}\r\n${value}\r\n`

    },

    RPOP: (args) => {
        if(args.length < 1){
            return "-ERR Wrong number of arguments for `RPOP` command\r\n"
        }

        const [key] = args

        if(checkExpiry(key) || !store[key] || store[key].type !== "list" || store[key].value.length === 0){
            return "#f\r\n"
        }

        const value = store[key].value.pop()

        return `$${value.length}\r\n${value}\r\n`
    },

    LRANGE: (args) => {
        if(args.length < 3){
            return "-ERR Wrong number of arguments for `LRANGE` command\r\n"
        }

        const [key, start, end] = args

        if(checkExpiry(key) || !store[key] || store[key].type !== "list"){
            return "#f\r\n"
        }

        const list = store[key].value
        const startIndex = parseInt(start, 10)
        const endIndex = parseInt(end, 10)

        if(isNaN(startIndex) || isNaN(endIndex) || startIndex >= list.length || endIndex >= list.length || startIndex < 0 || endIndex < 0 || startIndex > endIndex){
            return "-ERR Invalid start or end range value\r\n"
        }

        const range = list.slice(startIndex, endIndex + 1)

        let response = `*${range.length}\r\n`

        range.forEach((value) => {
            response += `$${value.length}\r\n${value}\r\n`
        })

        return response
    },

    SUCCESS: () => "+OK\r\n",
    
};

const executeCommand = (command, args, replayingFromAOF = false) => {
    logger.info(`Received ${command} ${args} ${replayingFromAOF || "AOF"}`)

    const handler = commandHandlers[command]

    if(!handler){
        return "-ERR unknown command\r\n"
    }

    const result = handler(args)

    if(config.appendonly && !replayingFromAOF && config.aofCommands.includes(command)){
        appendOnly.appendAof(command, args).then(() => {}).catch(logger.error)
    }

    return result
}

const init = () => {
    if(config.snapshot){
        logger.info("Persistence mode: `snapshot`")
        snapshot.loadSnapshotSync()

        setInterval(async () => {
            await snapshot.saveSnapshot();
        }, config.snapshotInterval)
    }
    else if(config.appendonly){
        logger.info("Persistence mode: `append-only`")
        appendOnly.replayAofSync(executeCommand)
    }
    else{
        logger.info("Persistence mode: `in-memory`")
    }
    
}

module.exports = {
    init,
    executeCommand
}