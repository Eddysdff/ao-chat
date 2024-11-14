-- 初始化状态
if not Handlers.utils then
  Handlers.utils = {}
end

-- 初始化状态
if not State then
  State = {
    invitations = {},  -- 存储所有邀请
    contacts = {},     -- 存储所有用户的联系人列表
    nicknames = {},     -- 存储用户昵称的修改历史
    chatrooms = {},       -- 用户的聊天室列表
    chatInvitations = {},  -- 聊天室邀请
    publicKeys = {}  -- 存储参与者的公钥
  }
end

-- 常量
local INVITATION_EXPIRE_DAYS = 7  -- 邀请7天后过期
local MAX_NICKNAME_LENGTH = 32    -- 昵称最大长度

-- 工具函数
function isExpired(timestamp)
  local now = os.time()
  return (now - timestamp) > (INVITATION_EXPIRE_DAYS * 24 * 60 * 60)
end

function validateNickname(nickname)
  return nickname and string.len(nickname) <= MAX_NICKNAME_LENGTH
end

function cleanExpiredInvitations(address)
  if not State.invitations[address] then return end
  
  local valid = {}
  for _, inv in ipairs(State.invitations[address]) do
    if not isExpired(inv.timestamp) and inv.status == "pending" then
      table.insert(valid, inv)
    end
  end
  State.invitations[address] = valid
end

-- 添加 JSON 处理函数
local function encode(data)
  if not ao or not ao.json then
    -- 如果 ao.json 不可用，使用简单的字符串化
    local function serialize(val)
      if type(val) == "table" then
        local res = "{"
        for k, v in pairs(val) do
          if type(k) == "string" then
            res = res .. k .. "="
          end
          res = res .. serialize(v) .. ","
        end
        return res .. "}"
      elseif type(val) == "string" then
        return '"' .. val .. '"'
      else
        return tostring(val)
      end
    end
    return serialize(data)
  else
    return ao.json.encode(data)
  end
end

-- 处理发送邀请
Handlers.add(
  "send-invitation",
  Handlers.utils.hasMatchingTag("Action", "SendInvitation"),
  function(msg)
    local from = msg.From
    local to = msg.Data.to
    local fromNickname = msg.Data.nickname

    -- 添加调试日志
    print("Sending invitation from:", from)
    print("To:", to)
    print("Nickname:", fromNickname)

    -- 验证昵称
    if not validateNickname(fromNickname) then
      return encode({ success = false, error = "Invalid nickname length" })
    end

    -- 清理接收者的过期邀请
    cleanExpiredInvitations(to)

    -- 检查是否已经是系人
    if State.contacts[from] then
      for _, contact in ipairs(State.contacts[from]) do
        if contact.address == to then
          return encode({ success = false, error = "Already in contacts" })
        end
      end
    end

    -- 确保State.invitations已初始化
    if not State.invitations then
      State.invitations = {}
    end

    -- 确保接收者的邀请列表已初始化
    if not State.invitations[to] then
      State.invitations[to] = {}
    end

    -- 创建新邀请
    local invitation = {
      from = from,
      to = to,
      fromNickname = fromNickname,
      status = "pending",
      timestamp = os.time()
    }

    -- 添加邀请到列表
    table.insert(State.invitations[to], invitation)

    -- 添加调试日志
    print("Invitation created:", encode(invitation))
    print("Updated invitations for recipient:", encode(State.invitations[to]))

    return encode({
      success = true,
      invitation = invitation,
      debug = {
        recipientInvitations = State.invitations[to],
        allInvitations = State.invitations
      }
    })
  end
)

-- 处理接受邀请
Handlers.add(
  "accept-invitation",
  Handlers.utils.hasMatchingTag("Action", "AcceptInvitation"),
  function(msg)
    local to = msg.From
    local from = msg.Data.from
    local toNickname = msg.Data.nickname

    if not validateNickname(toNickname) then
      return encode({ success = false, error = "Invalid nickname length" })
    end

    cleanExpiredInvitations(to)

    for _, inv in ipairs(State.invitations[to] or {}) do
      if inv.from == from and inv.status == "pending" then
        inv.status = "accepted"
        
        -- 添加双向联系人关系
        if not State.contacts[to] then
          State.contacts[to] = {}
        end
        if not State.contacts[from] then
          State.contacts[from] = {}
        end

        table.insert(State.contacts[to], {
          address = from,
          nickname = inv.fromNickname
        })
        table.insert(State.contacts[from], {
          address = to,
          nickname = toNickname
        })

        return encode({ success = true })
      end
    end

    return encode({ success = false, error = "Invitation not found or expired" })
  end
)

-- 处理拒绝邀请
Handlers.add(
  "reject-invitation",
  Handlers.utils.hasMatchingTag("Action", "RejectInvitation"),
  function(msg)
    local to = msg.From
    local from = msg.Data.from

    cleanExpiredInvitations(to)

    for _, inv in ipairs(State.invitations[to]) do
      if inv.from == from and inv.status == "pending" then
        inv.status = "rejected"
        return encode({ success = true })
      end
    end

    return encode({ success = false, error = "Invitation not found or expired" })
  end
)

-- 删除联系人
Handlers.add(
  "remove-contact",
  Handlers.utils.hasMatchingTag("Action", "RemoveContact"),
  function(msg)
    local from = msg.From
    local target = msg.Data.address

    -- 从双方的联系人列表中删除
    local function removeFromList(owner, target)
      if State.contacts[owner] then
        local newList = {}
        for _, contact in ipairs(State.contacts[owner]) do
          if contact.address ~= target then
            table.insert(newList, contact)
          end
        end
        State.contacts[owner] = newList
      end
    end

    removeFromList(from, target)
    removeFromList(target, from)

    return encode({ success = true })
  end
)

-- 修改联系人昵称
Handlers.add(
  "update-nickname",
  Handlers.utils.hasMatchingTag("Action", "UpdateNickname"),
  function(msg)
    local from = msg.From
    local target = msg.Data.address
    local newNickname = msg.Data.nickname

    if not validateNickname(newNickname) then
      return encode({ success = false, error = "Invalid nickname length" })
    end

    -- 更新昵称
    if State.contacts[from] then
      for _, contact in ipairs(State.contacts[from]) do
        if contact.address == target then
          contact.nickname = newNickname
          
          -- 记录昵称修改历史
          if not State.nicknames[from] then
            State.nicknames[from] = {}
          end
          table.insert(State.nicknames[from], {
            target = target,
            nickname = newNickname,
            timestamp = os.time()
          })
          
          return encode({ success = true })
        end
      end
    end

    return encode({ success = false, error = "Contact not found" })
  end
)

-- 获取待处理的邀请
Handlers.add(
  "get-pending-invitations",
  Handlers.utils.hasMatchingTag("Action", "GetPendingInvitations"),
  function(msg)
    local address = msg.From
    
    -- 添加调试日志
    print("Getting pending invitations for:", address)
    print("Current State:", encode(State))
    
    -- 清理过期邀请
    cleanExpiredInvitations(address)
    
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

-- 获取联系人列表
Handlers.add(
  "GetContacts",
  Handlers.utils.hasMatchingTag("Action", "GetContacts"),
  function(msg)
    local address = msg.From
    
    -- 添加调试日志
    print("Getting contacts for address:", address)
    
    -- 确保返回格式正确
    local response = {
      success = true,
      contacts = State.contacts[address] or {},
      error = nil
    }
    
    -- 使用 ao.json.encode 确保正确的 JSON 格式
    return ao.json.encode(response)
  end
)

-- 创建聊天室
Handlers.add(
  "create-chatroom",
  Handlers.utils.hasMatchingTag("Action", "CreateChatroom"),
  function(msg)
    local creator = msg.From
    local participant = msg.Data.participant

    -- 验证是否是联系人
    local isContact = false
    if State.contacts[creator] then
      for _, contact in ipairs(State.contacts[creator]) do
        if contact.address == participant then
          isContact = true
          break
        end
      end
    end

    if not isContact then
      return encode({ success = false, error = "Not in contacts" })
    end

    -- 读取聊天室模板
    local templateSrc = ao.env.CHATROOM_TEMPLATE
    if not templateSrc then
      return encode({ success = false, error = "Chatroom template not found" })
    end

    -- 注入参与者信息到模板
    local processCode = string.format(
      templateSrc,
      creator,    -- 替换模板中的创建者
      participant -- 替换模板中的参与者
    )

    -- 添加重试机制
    local maxRetries = 3
    local processId = nil
    
    for i = 1, maxRetries do
        local result = ao.spawn(processCode)
        if result.processId then
            processId = result.processId
            break
        end
        -- 等待短暂时间后重试
        ao.wait(1000)
    end
    
    if not processId then
        return encode({ success = false, error = "Failed to create chatroom" })
    end
    
    -- 验证Process是否正常运行
    local checkResult = ao.send(processId, {
        action = "health-check"
    })
    
    if not checkResult.ok then
        return encode({ success = false, error = "Chatroom validation failed" })
    end

    -- 记录聊天室信息
    local chatroomInfo = {
      processId = processId,
      creator = creator,
      participant = participant,
      createdAt = os.time()
    }

    -- 添加到创建者的聊天室列表
    if not State.chatrooms[creator] then
      State.chatrooms[creator] = {}
    end
    table.insert(State.chatrooms[creator], chatroomInfo)

    -- 添加到参与者的邀请列表
    if not State.chatInvitations[participant] then
      State.chatInvitations[participant] = {}
    end
    table.insert(State.chatInvitations[participant], chatroomInfo)

    return encode({ 
      success = true, 
      processId = processId,
      chatroom = chatroomInfo
    })
  end
)

-- 接受聊天室邀请
Handlers.add(
  "accept-chatroom",
  Handlers.utils.hasMatchingTag("Action", "accept-chatroom"),
  function(msg)
    local participant = msg.From
    local processId = msg.Data.processId

    -- 查找邀请
    local invitation = nil
    if State.chatInvitations[participant] then
      for i, inv in ipairs(State.chatInvitations[participant]) do
        if inv.processId == processId then
          invitation = table.remove(State.chatInvitations[participant], i)
          break
        end
      end
    end

    if not invitation then
      return encode({ success = false, error = "Invitation not found" })
    end

    -- 添加到参与者的聊天室列表
    if not State.chatrooms[participant] then
      State.chatrooms[participant] = {}
    end
    table.insert(State.chatrooms[participant], invitation)

    return encode({ success = true, chatroom = invitation })
  end
)

-- 获取用户的聊天室列表
Handlers.add(
  "get-chatrooms",
  Handlers.utils.hasMatchingTag("Action", "GetChatrooms"),
  function(msg)
    local address = msg.From
    return encode({ 
      success = true, 
      chatrooms = State.chatrooms[address] or {},
      invitations = State.chatInvitations[address] or {}
    })
  end
)

-- 添加存储公钥的处理器
Handlers.add(
  "store-public-key",
  Handlers.utils.hasMatchingTag("Action", "StorePublicKey"),
  function(msg)
    if not isParticipant(msg.From) then
      return encode({ success = false, error = "Not a participant" })
    end

    State.publicKeys[msg.From] = msg.Data.publicKey
    return encode({ success = true })
  end
)

-- 获取公钥的处理器
Handlers.add(
  "get-public-key",
  Handlers.utils.hasMatchingTag("Action", "GetPublicKey"),
  function(msg)
    if not isParticipant(msg.From) then
      return encode({ success = false, error = "Not a participant" })
    end

    local targetAddress = msg.Data.address
    if not State.publicKeys[targetAddress] then
      return encode({ success = false, error = "Public key not found" })
    end

    return encode({ 
      success = true, 
      publicKey = State.publicKeys[targetAddress] 
    })
  end
)

-- 修改发送消息的处理器以支持加密消息
Handlers.add(
  "send",
  Handlers.utils.hasMatchingTag("Action", "Send"),
  function(msg)
    if not isParticipant(msg.From) then
      return encode({ success = false, error = "Not a participant" })
    end

    local message = {
      sender = msg.From,
      encrypted = msg.Data.encrypted,
      iv = msg.Data.iv,
      timestamp = os.time()
    }
    
    table.insert(State.messages, message)
    return encode({ success = true, message = message })
  end
)

-- 添加健康检查处理器
Handlers.add(
  "HealthCheck",
  Handlers.utils.hasMatchingTag("Action", "HealthCheck"),
  function(msg)
    return encode({
      success = true,
      timestamp = os.time()
    })
  end
)

-- 确保State正确初始化
if not State then
  State = {
    invitations = {},
    contacts = {},
    nicknames = {}
  }
end

-- 添加辅助函数用于检查State
function debugState()
  return encode({
    success = true,
    state = {
      invitations = State.invitations,
      contacts = State.contacts,
      nicknames = State.nicknames
    },
    stats = {
      invitationsCount = 0,
      contactsCount = 0,
      nicknamesCount = 0
    }
  })
end

-- 添加调试处理器
Handlers.add(
  "debug-state",
  Handlers.utils.hasMatchingTag("Action", "DebugState"),
  function(msg)
    return debugState()
  end
)

-- 处理获取聊天室邀请
Handlers.add(
  "get-chatroom-invitations",
  Handlers.utils.hasMatchingTag("Action", "get-chatroom-invitations"),
  function(msg)
    local address = msg.From
    
    -- 添加调试日志
    print("Getting chatroom invitations for address:", address)
    print("Current State.chatroomInvitations:", encode(State.chatroomInvitations))
    
    return encode({
      success = true,
      chatInvitations = State.chatroomInvitations and State.chatroomInvitations[address] or {}
    })
  end
)

-- 处理接受聊天室邀请
Handlers.add(
  "accept-chatroom",
  Handlers.utils.hasMatchingTag("Action", "accept-chatroom"),
  function(msg)
    local participant = msg.From
    local processId = msg.Data.processId

    -- 查找邀请
    local invitation = nil
    if State.chatInvitations[participant] then
      for i, inv in ipairs(State.chatInvitations[participant]) do
        if inv.processId == processId then
          invitation = table.remove(State.chatInvitations[participant], i)
          break
        end
      end
    end

    if not invitation then
      return encode({ success = false, error = "Invitation not found" })
    end

    -- 添加到参与者的聊天室列表
    if not State.chatrooms[participant] then
      State.chatrooms[participant] = {}
    end
    table.insert(State.chatrooms[participant], invitation)

    return encode({ success = true, chatroom = invitation })
  end
)

-- 处理拒绝聊天室邀请
Handlers.add(
  "reject-chatroom",
  Handlers.utils.hasMatchingTag("Action", "reject-chatroom"),
  function(msg)
    local to = msg.From
    local from = msg.Data.from

    cleanExpiredInvitations(to)

    for _, inv in ipairs(State.invitations[to]) do
      if inv.from == from and inv.status == "pending" then
        inv.status = "rejected"
        return encode({ success = true })
      end
    end

    return encode({ success = false, error = "Invitation not found or expired" })
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
    
    -- 清理过期邀请
    cleanExpiredInvitations(address)
    
    -- 获取该地址的所有待处理邀请
    local pendingInvitations = {}
    if State.invitations[address] then
      for _, inv in ipairs(State.invitations[address]) do
        if inv.status == "pending" then
          table.insert(pendingInvitations, inv)
        end
      end
    end

    -- 确保返回格式正确
    local response = {
      success = true,
      invitations = pendingInvitations,
      error = nil
    }
    
    -- 使用 ao.json.encode 确保正确的 JSON 格式
    return ao.json.encode(response)
  end
) 