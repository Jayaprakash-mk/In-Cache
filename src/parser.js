const logger = require("./utils/logger")("parser")

const parseCommand = (data) => {
    const lines = data
        .toString()
        .split("\r\n")
        .filter((line) => !!line)

    const command = lines[2].toUpperCase()
    const args = lines.slice(4).filter((param,index) => index%2 === 0)
    logger.info(command)
    logger.info(args)

    return {command, args}
}

module.exports = {
    parseCommand
}