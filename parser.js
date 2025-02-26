const logger = require("./logger")("parser")

const parseCommand = (data) => {
    const lines = data
        .toString()
        .split("\r\n")
        .filter((line) => !!line)

    const command = lines[2].toUpperCase()
    const args = lines.slice(4).filter((param,index) => index%2 === 0)
    logger.log(command)
    logger.log(args)

    return {command, args}
}

module.exports = {
    parseCommand
}