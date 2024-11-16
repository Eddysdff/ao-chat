-- 初始化状态
if not State then
  State = {
    contacts = {},      -- 存储联系人信息 {address: {contacts: [{address, nickname, status}]}}
    invitations = {},   -- 存储联系人邀请 {address: [{from, fromNickname, status, timestamp}]}
    messages = {},      -- 存储消息历史 {sessionId: [{sender, receiver, content, timestamp, status}]}
    userStatus = {}     -- 存储用户状态 {address: {status, lastSeen}}
  }
end

-- 工具函数：生成会话ID
function generateSessionId(addr1, addr2)
  local addrs = {addr1, addr2}
  table.sort(addrs)
  return addrs[1] .. "_" .. addrs[2]
end

-- 工具函数：验证地址格式
function isValidAddress(address)
  return type(address) == "string" and string.len(address) == 43
end

-- 工具函数：验证消息格式
function isValidMessage(msg)
  return msg and msg.content and msg.receiver and
         isValidAddress(msg.receiver)
end

-- 添加 JSON 编码函数
local function encode(data)
  if ao and ao.json then
    -- 使用 ao.json
    local success, result = pcall(function()
      return ao.json.encode(data)
    end)
    
    if success then
      return result
    end
  end

  -- 如果 ao.json 不可用，使用自定义序列化
  local function serialize(val)
    local t = type(val)
    if t == "table" then
      local res = "{"
      local first = true
      for k, v in pairs(val) do
        if not first then
          res = res .. ","
        end
        first = false
        if type(k) == "string" then
          res = res .. '"' .. k .. '":'
        end
        res = res .. serialize(v)
      end
      return res .. "}"
    elseif t == "string" then
      return '"' .. string.gsub(val, '"', '\\"') .. '"'
    elseif t == "number" or t == "boolean" then
      return tostring(val)
    elseif t == "nil" then
      return "null"
    else
      return '"' .. tostring(val) .. '"'
    end
  end

  return serialize(data)
end

-- 发送联系人邀请
Handlers.add(
  "SendInvitation",
  Handlers.utils.hasMatchingTag("Action", "SendInvitation"),
  function(msg)
    local from = msg.From
    local to = msg.Data.to
    local fromNickname = msg.Data.fromNickname

    -- 添加调试日志
    print("Processing invitation request:")
    print("From:", from)
    print("To:", to)
    print("FromNickname:", fromNickname)

    -- 验证参数
    if not isValidAddress(to) then
      return encode({
        success = false,
        error = "Invalid address format"
      })
    end

    -- 初始化接收者的邀请列表
    if not State.invitations[to] then
      State.invitations[to] = {}
    end

    -- 检查是否已经是联系人
    if State.contacts[from] and State.contacts[from][to] then
      return encode({
        success = false,
        error = "Already in contacts"
      })
    end

    -- 检查是否已经有待处理的邀请
    for _, inv in ipairs(State.invitations[to]) do
      if inv.from == from and inv.status == "pending" then
        return encode({
          success = false,
          error = "Invitation already sent"
        })
      end
    end

    -- 创建新邀请
    local invitation = {
      from = from,
      fromNickname = fromNickname,
      status = "pending",
      timestamp = os.time()
    }

    -- 添加到邀请列表
    table.insert(State.invitations[to], invitation)

    -- 添加调试日志
    print("Created invitation:", encode(invitation))
    print("Updated invitations for recipient:", encode(State.invitations[to]))

    return encode({
      success = true,
      invitation = invitation
    })
  end
)

-- 获取待处理的邀请
Handlers.add(
  "GetPendingInvitations",
  Handlers.utils.hasMatchingTag("Action", "GetPendingInvitations"),
  function(msg)
    local address = msg.From
    
    -- 添加调试日志
    print("Getting pending invitations for:", address)
    print("Current invitations state:", encode(State.invitations))
    
    -- 获取该地址的所有待处理邀请
    local pendingInvitations = {}
    if State.invitations[address] then
      for _, inv in ipairs(State.invitations[address]) do
        if inv.status == "pending" then
          table.insert(pendingInvitations, inv)
        end
      end
    end

    -- 添加调试日志
    print("Found pending invitations:", encode(pendingInvitations))

    return encode({
      success = true,
      invitations = pendingInvitations
    })
  end
)

-- 接受联系人邀请
Handlers.add(
  "AcceptInvitation",
  Handlers.utils.hasMatchingTag("Action", "AcceptInvitation"),
  function(msg)
    local address = msg.From
    local from = msg.Data.from
    local nickname = msg.Data.nickname

    -- 查找并更新邀请状态
    local invitation = nil
    if State.invitations[address] then
      for _, inv in ipairs(State.invitations[address]) do
        if inv.from == from and inv.status == "pending" then
          inv.status = "accepted"
          invitation = inv
          break
        end
      end
    end

    if not invitation then
      return encode({
        success = false,
        error = "Invitation not found"
      })
    end

    -- 初始化联系人列表
    if not State.contacts[address] then
      State.contacts[address] = {}
    end
    if not State.contacts[from] then
      State.contacts[from] = {}
    end

    -- 添加到双方的联系人列表
    State.contacts[address][from] = {
      address = from,
      nickname = invitation.fromNickname,
      status = "offline",
      lastSeen = os.time()
    }

    State.contacts[from][address] = {
      address = address,
      nickname = nickname,
      status = "offline",
      lastSeen = os.time()
    }

    return encode({
      success = true
    })
  end
)

-- 获取联系人列表
Handlers.add(
  "GetContacts",
  Handlers.utils.hasMatchingTag("Action", "GetContacts"),
  function(msg)
    local address = msg.From
    local contacts = {}

    -- 转换联系人列表格式
    if State.contacts[address] then
      for _, contact in pairs(State.contacts[address]) do
        table.insert(contacts, contact)
      end
    end

    return encode({
      success = true,
      contacts = contacts
    })
  end
)

-- 发送消息
Handlers.add(
  "SendMessage",
  Handlers.utils.hasMatchingTag("Action", "SendMessage"),
  function(msg)
    local sender = msg.From
    local receiver = msg.Data.receiver
    local content = msg.Data.content
    local encrypted = msg.Data.encrypted

    -- 验证消息
    if not isValidMessage(msg.Data) then
      return encode({
        success = false,
        error = "Invalid message format"
      })
    end

    -- 验证是否是联系人
    if not (State.contacts[sender] and State.contacts[sender][receiver]) then
      return encode({
        success = false,
        error = "Not in contacts"
      })
    end

    -- 生成会话ID
    local sessionId = generateSessionId(sender, receiver)

    -- 初始化消息存储
    if not State.messages[sessionId] then
      State.messages[sessionId] = {}
    end

    -- 创建新消息
    local message = {
      id = #State.messages[sessionId] + 1,
      sender = sender,
      receiver = receiver,
      content = content,
      timestamp = os.time(),
      status = "sent",
      encrypted = encrypted
    }

    -- 存储消息
    table.insert(State.messages[sessionId], message)

    return encode({
      success = true,
      message = message
    })
  end
)

-- 获取消息历史
Handlers.add(
  "GetMessages",
  Handlers.utils.hasMatchingTag("Action", "GetMessages"),
  function(msg)
    local address = msg.From
    local otherAddress = msg.Data.otherAddress
    local sessionId = generateSessionId(address, otherAddress)

    -- 验证是否是联系人
    if not (State.contacts[address] and State.contacts[address][otherAddress]) then
      return encode({
        success = false,
        error = "Not in contacts"
      })
    end

    -- 获取消息并更新状态
    local messages = State.messages[sessionId] or {}
    for _, message in ipairs(messages) do
      if message.receiver == address and message.status == "sent" then
        message.status = "delivered"
      end
    end

    return encode({
      success = true,
      messages = messages
    })
  end
)

-- 更新消息状态
Handlers.add(
  "UpdateMessageStatus",
  Handlers.utils.hasMatchingTag("Action", "UpdateMessageStatus"),
  function(msg)
    local address = msg.From
    local messageId = msg.Data.messageId
    local sessionId = msg.Data.sessionId
    local status = msg.Data.status

    if not State.messages[sessionId] then
      return encode({
        success = false,
        error = "Session not found"
      })
    end

    -- 更新消息状态
    for _, message in ipairs(State.messages[sessionId]) do
      if message.id == messageId and message.receiver == address then
        message.status = status
        break
      end
    end

    return encode({
      success = true
    })
  end
)

