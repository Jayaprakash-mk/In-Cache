const { send } = require("express/lib/response");
const net = require("net")
const assert = require("node:assert")
const {before, after, test} = require("node:test");
const { buildRedisCommand } = require("../src/utils/commonUtils");

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

        redisClient.write(buildRedisCommand(command))

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

test("should return $-1 for a non-existent key", async () => {
    const getResponse = await sendCommand("get foo1");
    assert.strictEqual(getResponse, "#f\r\n");
  });
  
  test("should DEL a key", async () => {
    await sendCommand("set fooDel poorBar");
    const delResponse = await sendCommand("del fooDel");
    assert.strictEqual(delResponse, ":1\r\n");
  
    const getResponse = await sendCommand("get fooDel");
    assert.strictEqual(getResponse, "#f\r\n");
  });
  
  test("should EXPIRE a key", async () => {
    await sendCommand("set fooExp expBar");
    const expireResponse = await sendCommand("expire fooExp 1");
    assert.strictEqual(expireResponse, "#t\r\n");
  
    await new Promise((resolve) => setTimeout(resolve, 1100)); // wait for 1.1 seconds
  
    const getResponse = await sendCommand("get fooExp");
    assert.strictEqual(getResponse, "#f\r\n");
  });

  test("should handle unknown commands gracefully", async () => {
    const response = await sendCommand("JP test");
    assert.strictEqual(response, "-ERR unknown command\r\n");
  });

  test("should return correct TTL for a key and error cases", async () => {
    await sendCommand("set fooT expT");
    const expireResponse = await sendCommand("expire fooT 5");
    assert.strictEqual(expireResponse, "#t\r\n");
  
    await new Promise((resolve) => setTimeout(resolve, 2000));
  
    const getResponse = await sendCommand("ttl fooT");
    console.log(getResponse);
    const match = getResponse.match(/^:(\d+)\r\n$/);
    const ttlValue = parseInt(match[1]);
  
    // As timeout wont be exact 2 seconds
    assert.ok(ttlValue <= 3, "Expected ttlValue to be less than or equal to 3");
  
    const errorResponse = await sendCommand("ttl");
    assert.strictEqual(
      errorResponse,
      "-ERR Wrong number of arguments for `TTL` command\r\n"
    );
  });

  test("should INCR a key and error cases", async () => {
    await sendCommand("set fooI 5");
  
    const response1 = await sendCommand("incr fooI");
    assert.strictEqual(response1, ":6\r\n");
  
    const getResponse1 = await sendCommand("get fooI");
    assert.strictEqual(getResponse1, "$1\r\n6\r\n");
  
    const response2 = await sendCommand("incr");
    assert.strictEqual(
      response2,
      "-ERR Wrong number of arguments for `INCR` command\r\n"
    );
  
    await sendCommand("set fooInvali tada1");
    const errorResponse1 = await sendCommand("incr fooInvali");
    assert.strictEqual(
      errorResponse1,
      "-ERR value is not an integer or out of range\r\n"
    );
  
    const response3 = await sendCommand("incr incNewValue");
    assert.strictEqual(response3, ":1\r\n");

    //for command with 2 arguments
    await sendCommand("set newParamKey 5");
  
    const response4 = await sendCommand("incr newParamKey 4");
    assert.strictEqual(response4, ":9\r\n");
  
    const getResponse2 = await sendCommand("get newParamKey");
    assert.strictEqual(getResponse2, "$1\r\n9\r\n");
  
    const response5 = await sendCommand("incr newParamKey invalid");
    assert.strictEqual(
      response5,
      "-ERR increment argument is not an integer or out of range\r\n"
    );
  
    await sendCommand("set fooInvali tada1");
    const errorResponse2 = await sendCommand("incr fooInvali 2");
    assert.strictEqual(
      errorResponse2,
      "-ERR value is not an integer or out of range\r\n"
    );
  
    const response6 = await sendCommand("incr incNewValue2 5");
    assert.strictEqual(response6, ":5\r\n");
  });

  test("should DECR a key and error cases", async () => {
    await sendCommand("set fooD 11");
  
    const response1 = await sendCommand("decr fooD");
    assert.strictEqual(response1, ":10\r\n");
  
    const getResponse = await sendCommand("get fooD");
    assert.strictEqual(getResponse, "$2\r\n10\r\n");
  
    const response2 = await sendCommand("decr");
    assert.strictEqual(
      response2,
      "-ERR Wrong number of arguments for `DECR` command\r\n"
    );
  
    await sendCommand("set fooInvali tada2");
    const errorResponse = await sendCommand("decr fooInvali");
    assert.strictEqual(
      errorResponse,
      "-ERR value is not an integer or out of range\r\n"
    );
  
    const response3 = await sendCommand("decr decNewValue1");
    assert.strictEqual(response3, ":-1\r\n");

    //for command with 2 arguments
    await sendCommand("set decParamKey 5");
  
    const response4 = await sendCommand("decr decParamKey 4");
    assert.strictEqual(response4, ":1\r\n");
  
    const getResponse2 = await sendCommand("get decParamKey");
    assert.strictEqual(getResponse2, "$1\r\n1\r\n");
  
    const response5 = await sendCommand("decr decParamKey invalid");
    assert.strictEqual(
      response5,
      "-ERR increment argument is not an integer or out of range\r\n"
    );
  
    await sendCommand("set fooInvali tada1");
    const errorResponse2 = await sendCommand("decr fooInvali 2");
    assert.strictEqual(
      errorResponse2,
      "-ERR value is not an integer or out of range\r\n"
    );
  
    const response6 = await sendCommand("decr decNewValue2 5");
    assert.strictEqual(response6, ":-5\r\n");
  });

  test("should return error for LRANGE invalid key", async () => {
    const errorResponse1 = await sendCommand("lrange list1");
    assert.strictEqual(
      errorResponse1,
      "-ERR Wrong number of arguments for `LRANGE` command\r\n"
    );
  
    const errorResponse2 = await sendCommand("lrange list1 0 4");
    assert.strictEqual(errorResponse2, "#f\r\n");

    const lPushResponse1 = await sendCommand("lpush newList el1");
    assert.strictEqual(lPushResponse1, ":1\r\n");
  
    const errorResponse3 = await sendCommand("lrange newList 2 1");
    assert.strictEqual(
        errorResponse3, 
        "-ERR Invalid start or end range value\r\n"
    );
  
    const errorResponse4 = await sendCommand("lrange newList one two");
    assert.strictEqual(
        errorResponse4, 
        "-ERR Invalid start or end range value\r\n"
    );
  });
  
  test("should LPUSH for a key, error cases and LRANGE", async () => {
    const lPushResponse = await sendCommand("lpush list1 el1");
    assert.strictEqual(lPushResponse, ":1\r\n");
  
    const lRangeResponse = await sendCommand("lrange list1 0 0");
    assert.strictEqual(lRangeResponse, "*1\r\n$3\r\nel1\r\n");
  
    const errorResponse1 = await sendCommand("lpush foo");
    assert.strictEqual(
      errorResponse1,
      "-ERR Wrong number of arguments for `LPUSH` command\r\n"
    );
  
    await sendCommand("set foo bar");
    const errorResponse2 = await sendCommand("lpush foo one");
    assert.strictEqual(errorResponse2, "-ERR Wrong type of key\r\n");
  });

  test("should LPOP for a key, error cases and LRANGE", async () => {
    const lPopResponse1 = await sendCommand("lpop list3");
    assert.strictEqual(lPopResponse1, "#f\r\n");
  
    await sendCommand("lpush list3 el1");
    await sendCommand("lpush list3 el2");
  
    const lRangeResponse = await sendCommand("lrange list3 0 1");
    assert.strictEqual(lRangeResponse, "*2\r\n$3\r\nel2\r\n$3\r\nel1\r\n");
  
    const lPopResponse2 = await sendCommand("lpop list3");
    assert.strictEqual(lPopResponse2, "$3\r\nel2\r\n");
  
    const errorResponse = await sendCommand("lpop");
    assert.strictEqual(
      errorResponse,
      "-ERR Wrong number of arguments for `LPOP` command\r\n"
    );
  });
  
  test("should RPOP for a key, error cases and LRANGE", async () => {
    const rPopResponse1 = await sendCommand("rpop list4");
    assert.strictEqual(rPopResponse1, "#f\r\n");
  
    await sendCommand("lpush list4 el1");
    await sendCommand("lpush list4 el2");
  
    const lRangeResponse = await sendCommand("lrange list4 0 1");
    assert.strictEqual(lRangeResponse, "*2\r\n$3\r\nel2\r\n$3\r\nel1\r\n");
  
    const lPopResponse2 = await sendCommand("rpop list4");
    assert.strictEqual(lPopResponse2, "$3\r\nel1\r\n");
  
    const errorResponse = await sendCommand("rpop");
    assert.strictEqual(
      errorResponse,
      "-ERR Wrong number of arguments for `RPOP` command\r\n"
    );
  });