const { send } = require("express/lib/response");
const net = require("net")
const assert = require("node:assert")
const {before, after, test} = require("node:test")

let redisClient;

const connectToRedis = () => {
    return new Promise((resolve) => {
        redisClient = net.createConnection({port: 6379}, () => {
            resolve()
        })

        redisClient.on("error", (err) => {
            rejects(err)
        })
    })
}

before(async () => {
    await connectToRedis()
})

after(async () => {
    if(redisClient && !redisClient.destroyed){
        redisClient.end()
    }
})

const onError = (err) => {
    rejects(err)
}

const sendCommand = (command) => {
    return new Promise((resolve, target) => {
        if(!redisClient || redisClient.destroyed) {
            rejects(new Error("Client is not connected"))
            return
        }

        redisClient.write(command)

        redisClient.once("data", (data) => {
            resolve(data.toString())
            redisClient.removeListener("error", onError)
        })

        redisClient.once("error", onError)
    })
}

test("should SET and GET a value", async () => {
    const sendResponse = await sendCommand("set foo bar")
    assert.strictEqual(sendResponse, "+OK\r\n")

    const getResponse = await sendCommand("get foo")
    assert.strictEqual(getResponse, "$3\r\nbar\r\n")
})