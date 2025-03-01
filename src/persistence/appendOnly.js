const fs = require("fs")
const fsPromise = fs.promises
const path = require("path")
const config = require("../config.json")
const logger = require("../utils/logger.js")("persistence")

class appendOnly {
    AOF_FILE = path.join(__dirname, "data.aof")

    async appendAof(command, args) {
        let cmd = `${command} ${args.join(" ")}\r\n`

        try{
            await fsPromise.appendFile(this.AOF_FILE, cmd)
            logger.info(`Appended to AOF file: ${cmd.trim()}`)
        }
        catch (err) {
            logger.error(`Failed to append the Command in AOF file: ${err.message}`)
        }
    }

    replayAofSync(executeCommand) {
        if(!config.appendonly || !fs.existsSync(this.AOF_FILE)) return

        try {
            const data = fs.readFileSync(this.AOF_FILE).toString()

            if(!data) return;

            const logs = data.split("\r\n").filter(Boolean)
            
            logger.info(`Replay AOF commands started`)

            for (const cmd of logs){
                const [command, ...args] = cmd.split(" ")
                executeCommand(command, args, true)
            }

            logger.info(`Replay AOF commands completed successfully`)
        }
        catch (err) {
            logger.error(`Failed to replay AOF: ${err.message}`)
        }
    }
}

module.exports = new appendOnly()