const logger = require("./logger")("Redis")

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
            return "$-1\r\n"
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