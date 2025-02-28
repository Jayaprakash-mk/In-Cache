const buildRedisCommand = (input) => {
    const args = input.split(" ")
    let command = `*${args.length}\r\n`

    args.forEach((str) => {
        command += `$${str.length}\r\n${str}\r\n`
    })

    return command
}

module.exports = {
    buildRedisCommand
}