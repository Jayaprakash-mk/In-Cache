const net = require('net')
const logger = require('./logger')("server")

const server = net.createServer()
const port = 6379
const host = "127.0.0.1"

server.on("connection", (socket) => {
    socket.on("data", (data) => {
        const reqData = data.toString()
        logger.log(reqData)
        socket.write("res: " + reqData)
    })

    socket.on("end", ()=> {
        console.log("client disconnected")
    })
})

server.listen(port, host, () => {
    logger.log(`Server is listening to ${host}:${port}`)
})