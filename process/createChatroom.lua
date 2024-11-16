-- chatroom-template.lua
if not State then
  State = {
    info = {
      created_at = os.time(),
      creator = "%s",    -- 将被替换为创建者地址
      participant = "%s" -- 将被替换为参与者地址
    },
    messages = {},
    participants = {}   -- 记录已加入的参与者
  }
end

-- 验证发送者权限
function isParticipant(address)
  return State.participants[address]
end

-- 加入聊天室
Handlers.add(
  "Join",
  Handlers.utils.hasMatchingTag("Action", "Join"),
  function(msg)
    local address = msg.From
    -- 只允许创建者和被邀请者加入
    if address == State.info.creator or address == State.info.participant then
      State.participants[address] = true
      return encode({ success = true })
    end
    return encode({ success = false, error = "Unauthorized" })
  end
)

-- 发送消息
Handlers.add(
  "send",
  Handlers.utils.hasMatchingTag("Action", "Send"),
  function(msg)
    if not isParticipant(msg.From) then
      return { success = false, error = "Not a participant" }
    end

    local message = {
      sender = msg.From,
      content = msg.Data.content,
      timestamp = os.time()
    }
    
    table.insert(State.messages, message)
    return { success = true, message = message }
  end
)

-- 获取消息历史（带分页）
Handlers.add(
  "get-messages",
  Handlers.utils.hasMatchingTag("Action", "GetMessages"),
  function(msg)
    if not isParticipant(msg.From) then
      return { success = false, error = "Not a participant" }
    end
    
    local page = msg.Data.page or 1
    local pageSize = msg.Data.pageSize or 20
    local totalMessages = #State.messages
    local startIndex = math.max(1, totalMessages - (page * pageSize) + 1)
    local endIndex = math.max(1, totalMessages - ((page - 1) * pageSize))
    
    local messages = {}
    for i = endIndex, startIndex, -1 do
      if State.messages[i] then
        table.insert(messages, State.messages[i])
      end
    end
    
    return { 
      success = true, 
      messages = messages,
      hasMore = startIndex > 1,
      total = totalMessages
    }
  end
)

-- 处理WebRTC信令
Handlers.add(
  "webrtc-signal",
  Handlers.utils.hasMatchingTag("Action", "WebRTCSignal"),
  function(msg)
    if not isParticipant(msg.From) then
      return { success = false, error = "Not a participant" }
    end

    local signal = {
      type = msg.Data.type,
      from = msg.From,
      data = msg.Data.data,
      timestamp = os.time()
    }
    
    return { success = true, signal = signal }
  end
)
