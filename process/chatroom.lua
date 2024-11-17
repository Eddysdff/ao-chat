-- 初始化状态和数据表
if not State then
  State = {
    -- 用户表：存储用户基本信息
    users = {
      -- 结构示例：
      -- ["address"] = {
      --   name = "用户名",
      --   avatar = "头像URL",
      --   timestamp = 123456789,
      --   status = "active"  -- active/offline
      -- }
    },

    -- 联系人表：存储用户的联系人关系
    contacts = {
      -- 结构示例：
      -- ["address1"] = {
      --   ["address2"] = {
      --     nickname = "昵称",
      --     timestamp = 123456789,
      --     status = "active"  -- active/blocked
      --   }
      -- }
    },

    -- 消息表：存储聊天记录
    messages = {
      -- 结构示例：
      -- ["address1_address2"] = {
      --   messages = {
      --     {
      --       id = "msg_1",
      --       sender = "address1",
      --       content = "消息内容",
      --       timestamp = 123456789,
      --       status = "delivered"  -- sent/delivered/read
      --     }
      --   },
      --   last_read = {
      --     ["address1"] = "msg_1",
      --     ["address2"] = "msg_1"
      --   }
      -- }
    },

    -- 未读消息表：存储未读消息计数
    unread = {
      -- 结构示例：
      -- ["address1"] = {
      --   ["address2"] = 3  -- 来自address2的3条未读消息
      -- }
    },

    -- 邀请表：存储好友邀请
    invitations = {
      -- 结构示例：
      -- ["to_address"] = {
      --   ["from_address"] = {
      --     fromNickname = "发送者昵称",
      --     timestamp = 123456789,
      --     status = "pending"  -- pending/accepted/rejected
      --   }
      -- }
    }
  }
end

-- 工具函数
if not Handlers.utils then
  Handlers.utils = {}
end

-- 验证地址格式
function Handlers.utils.validateAddress(address)
  return type(address) == "string" and string.match(address, "^[a-zA-Z0-9_-]+$")
end

-- 创建响应
function Handlers.utils.createResponse(success, data, error)
  return {
    success = success,
    data = data,
    error = error
  }
end

-- 生成消息ID
function Handlers.utils.generateMessageId()
  return "msg_" .. tostring(os.time()) .. "_" .. tostring(math.random(1000, 9999))
end

-- 生成会话ID
function Handlers.utils.getSessionId(addr1, addr2)
  -- 确保会话ID的一致性（地址按字母顺序排序）
  if addr1 < addr2 then
    return addr1 .. "_" .. addr2
  else
    return addr2 .. "_" .. addr1
  end
end

-- 检查用户是否存在
function Handlers.utils.userExists(address)
  return State.users[address] ~= nil
end

-- 检查是否为联系人
function Handlers.utils.areContacts(addr1, addr2)
  return State.contacts[addr1] and State.contacts[addr1][addr2] ~= nil
end

-- 1. 用户管理处理器
Handlers.add(
  "AddUser",
  Handlers.utils.hasMatchingTag("Action", "AddUser"),
  function(msg)
    local address = msg.From
    local data = msg.Data
    
    -- 验证数据
    if not data or type(data) ~= "table" then
      return Handlers.utils.createResponse(false, nil, "Invalid data format")
    end

    if not data.name or type(data.name) ~= "string" or #data.name == 0 then
      return Handlers.utils.createResponse(false, nil, "Invalid username")
    end

    -- 存储用户数据
    State.users[address] = {
      name = data.name,
      timestamp = data.timestamp or os.time(),
      status = "active"
    }

    return Handlers.utils.createResponse(true, {
      user = State.users[address]
    })
  end
)

-- 2. 联系人管理处理器
Handlers.add(
  "SendInvitation",
  Handlers.utils.hasMatchingTag("Action", "SendInvitation"),
  function(msg)
    local from = msg.From
    local data = msg.Data
    local to = data.to
    local fromNickname = data.fromNickname

    -- 验证地址
    if not Handlers.utils.validateAddress(from) or not Handlers.utils.validateAddress(to) then
      return Handlers.utils.createResponse(false, nil, "Invalid address format")
    end

    -- 验证用户存在
    if not Handlers.utils.userExists(from) or not Handlers.utils.userExists(to) then
      return Handlers.utils.createResponse(false, nil, "User not found")
    end

    -- 检查是否已经是联系人
    if Handlers.utils.areContacts(from, to) then
      return Handlers.utils.createResponse(false, nil, "Already contacts")
    end

    -- 检查现有邀请
    if State.invitations[to] and State.invitations[to][from] then
      return Handlers.utils.createResponse(false, nil, "Invitation already sent")
    end

    -- 添加邀请
    if not State.invitations[to] then
      State.invitations[to] = {}
    end

    State.invitations[to][from] = {
      fromNickname = fromNickname,
      timestamp = os.time(),
      status = "pending"
    }

    return Handlers.utils.createResponse(true, {
      from = from,
      to = to,
      timestamp = os.time()
    })
  end
)

Handlers.add(
  "AcceptInvitation",
  Handlers.utils.hasMatchingTag("Action", "AcceptInvitation"),
  function(msg)
    local to = msg.From
    local data = msg.Data
    local from = data.from
    local nickname = data.nickname

    -- 验证地址
    if not Handlers.utils.validateAddress(from) or not Handlers.utils.validateAddress(to) then
      return Handlers.utils.createResponse(false, nil, "Invalid address format")
    end

    -- 验证邀请
    if not State.invitations[to] or not State.invitations[to][from] then
      return Handlers.utils.createResponse(false, nil, "Invitation not found")
    end

    if State.invitations[to][from].status ~= "pending" then
      return Handlers.utils.createResponse(false, nil, "Invitation already processed")
    end

    -- 建立联系人关系
    if not State.contacts[from] then State.contacts[from] = {} end
    if not State.contacts[to] then State.contacts[to] = {} end

    -- 双向添加联系人
    State.contacts[from][to] = {
      nickname = nickname,
      timestamp = os.time(),
      status = "active"
    }

    State.contacts[to][from] = {
      nickname = State.invitations[to][from].fromNickname,
      timestamp = os.time(),
      status = "active"
    }

    -- 更新邀请状态
    State.invitations[to][from].status = "accepted"

    -- 初始化未读消息计数
    if not State.unread[from] then State.unread[from] = {} end
    if not State.unread[to] then State.unread[to] = {} end
    State.unread[from][to] = 0
    State.unread[to][from] = 0

    return Handlers.utils.createResponse(true, {
      from = from,
      to = to,
      timestamp = os.time()
    })
  end
)

-- 获取待处理邀请处理器
Handlers.add(
  "GetPendingInvitations",
  Handlers.utils.hasMatchingTag("Action", "GetPendingInvitations"),
  function(msg)
    local address = msg.From

    -- 验证地址
    if not Handlers.utils.validateAddress(address) then
      return Handlers.utils.createResponse(false, nil, "Invalid address format")
    end

    -- 获取待处理的邀请
    local pendingInvitations = {}
    if State.invitations[address] then
      for from, invitation in pairs(State.invitations[address]) do
        if invitation.status == "pending" then
          table.insert(pendingInvitations, {
            from = from,
            fromNickname = invitation.fromNickname,
            timestamp = invitation.timestamp
          })
        end
      end
    end

    return Handlers.utils.createResponse(true, {
      invitations = pendingInvitations
    })
  end
)

-- 3. 消息管理处理器
Handlers.add(
  "SendMessage",
  Handlers.utils.hasMatchingTag("Action", "SendMessage"),
  function(msg)
    local sender = msg.From
    local data = msg.Data
    local receiver = data.receiver
    local content = data.content
    local encrypted = data.encrypted or false

    -- 验证地址
    if not Handlers.utils.validateAddress(sender) or not Handlers.utils.validateAddress(receiver) then
      return Handlers.utils.createResponse(false, nil, "Invalid address format")
    end

    -- 验证消息内容
    if not content or type(content) ~= "string" or #content == 0 then
      return Handlers.utils.createResponse(false, nil, "Invalid message content")
    end

    -- 检查是否为联系人
    if not Handlers.utils.areContacts(sender, receiver) then
      return Handlers.utils.createResponse(false, nil, "Not contacts")
    end

    -- 生成会话ID和消息ID
    local sessionId = Handlers.utils.getSessionId(sender, receiver)
    local messageId = Handlers.utils.generateMessageId()

    -- 初始化会话
    if not State.messages[sessionId] then
      State.messages[sessionId] = {
        messages = {},
        last_read = {
          [sender] = nil,
          [receiver] = nil
        }
      }
    end

    -- 添加消息
    local message = {
      id = messageId,
      sender = sender,
      content = content,
      encrypted = encrypted,
      timestamp = os.time(),
      status = "sent"
    }
    table.insert(State.messages[sessionId].messages, message)

    -- 更新未读消息计数
    if not State.unread[receiver] then State.unread[receiver] = {} end
    if not State.unread[receiver][sender] then State.unread[receiver][sender] = 0 end
    State.unread[receiver][sender] = State.unread[receiver][sender] + 1

    return Handlers.utils.createResponse(true, {
      messageId = messageId,
      sessionId = sessionId,
      timestamp = message.timestamp
    })
  end
)

Handlers.add(
  "GetMessages",
  Handlers.utils.hasMatchingTag("Action", "GetMessages"),
  function(msg)
    local address = msg.From
    local data = msg.Data
    local otherAddress = data.otherAddress

    -- 验证地址
    if not Handlers.utils.validateAddress(address) or not Handlers.utils.validateAddress(otherAddress) then
      return Handlers.utils.createResponse(false, nil, "Invalid address format")
    end

    -- 检查是否为联系人
    if not Handlers.utils.areContacts(address, otherAddress) then
      return Handlers.utils.createResponse(false, nil, "Not contacts")
    end

    -- 获取会话ID
    local sessionId = Handlers.utils.getSessionId(address, otherAddress)
    
    -- 获取消息历史
    local messages = State.messages[sessionId] and State.messages[sessionId].messages or {}

    return Handlers.utils.createResponse(true, {
      sessionId = sessionId,
      messages = messages
    })
  end
)

-- 4. 消息状态处理器
Handlers.add(
  "UpdateMessageStatus",
  Handlers.utils.hasMatchingTag("Action", "UpdateMessageStatus"),
  function(msg)
    local address = msg.From
    local data = msg.Data
    local messageId = data.messageId
    local sessionId = data.sessionId
    local status = data.status

    -- 验证状态值
    if status ~= "delivered" and status ~= "read" then
      return Handlers.utils.createResponse(false, nil, "Invalid status")
    end

    -- 验证会话和消息是否存在
    if not State.messages[sessionId] then
      return Handlers.utils.createResponse(false, nil, "Session not found")
    end

    -- 更新消息状态
    local found = false
    for _, message in ipairs(State.messages[sessionId].messages) do
      if message.id == messageId then
        message.status = status
        found = true
        
        -- 如果是已读状态，更新最后读取时间
        if status == "read" then
          State.messages[sessionId].last_read[address] = messageId
          
          -- 清除未读计数
          local otherAddress = message.sender
          if State.unread[address] and State.unread[address][otherAddress] then
            State.unread[address][otherAddress] = 0
          end
        end
        break
      end
    end

    if not found then
      return Handlers.utils.createResponse(false, nil, "Message not found")
    end

    return Handlers.utils.createResponse(true, {
      messageId = messageId,
      sessionId = sessionId,
      status = status
    })
  end
)

-- 5. 查询处理器
Handlers.add(
  "GetContacts",
  Handlers.utils.hasMatchingTag("Action", "GetContacts"),
  function(msg)
    local address = msg.From

    -- 验证地址
    if not Handlers.utils.validateAddress(address) then
      return Handlers.utils.createResponse(false, nil, "Invalid address format")
    end

    -- 获取联系人列表
    local contacts = {}
    if State.contacts[address] then
      for contactId, contactInfo in pairs(State.contacts[address]) do
        -- 获取联系人的用户信
        local userInfo = State.users[contactId]
        if userInfo then
          contacts[contactId] = {
            address = contactId,
            nickname = contactInfo.nickname,
            name = userInfo.name,
            avatar = userInfo.avatar,
            status = contactInfo.status,
            unread = (State.unread[address] and State.unread[address][contactId]) or 0
          }
        end
      end
    end

    return Handlers.utils.createResponse(true, {
      contacts = contacts
    })
  end
)

Handlers.add(
  "GetPendingInvitations",
  Handlers.utils.hasMatchingTag("Action", "GetPendingInvitations"),
  function(msg)
    local address = msg.From

    -- 验证地址
    if not Handlers.utils.validateAddress(address) then
      return Handlers.utils.createResponse(false, nil, "Invalid address format")
    end

    -- 获取待处理的邀请
    local pendingInvitations = {}
    if State.invitations[address] then
      for from, invitation in pairs(State.invitations[address]) do
        if invitation.status == "pending" then
          -- 获取发送者的用户信息
          local userInfo = State.users[from]
          if userInfo then
            table.insert(pendingInvitations, {
              from = from,
              fromNickname = invitation.fromNickname,
              name = userInfo.name,
              avatar = userInfo.avatar,
              timestamp = invitation.timestamp
            })
          end
        end
      end
    end

    return Handlers.utils.createResponse(true, {
      invitations = pendingInvitations
    })
  end
)
