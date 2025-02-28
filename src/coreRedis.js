const logger = require("./utils/logger")("Redis")

const store = {}
const expirationTimes = {}

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

            return `:${parseInt(incValue)}\r\n`
        }

        const value = parseInt(store[key].value, 10);
        
        if(isNaN(value)) return "-ERR value is not an integer or out of range\r\n"

        if(args.length === 1) incValue = value + 1;
        else if(args.length === 2) incValue = value + parseInt(args[1]);
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

            return `:${parseInt(decValue)}\r\n`
        }

        const value = parseInt(store[key].value, 10);
        
        if(isNaN(value)) return "-ERR value is not an integer or out of range\r\n"

        if(args.length === 1) decValue = value - 1;
        else if(args.length === 2) decValue = value - parseInt(args[1]);
        store[key].value = (decValue).toString()

        logger.debug(decValue)

        return `:${decValue}\r\n`

    },

    SUCCESS: () => "+OK\r\n",
    
};

const executeCommand = (command, args) => {
    logger.info(`Received ${command} ${args}`)

    const handler = commandHandlers[command]

    if(!handler){
        return "-ERR unknown command\r\n"
    }
    return handler(args)
}

const init = () => {
    logger.info("Persistence mode: `in-memory`")
}

module.exports = {
    init,
    executeCommand
}