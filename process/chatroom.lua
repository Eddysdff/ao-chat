-- 初始化状态和数据表
if not State then
  State = {
    users = {},     -- 用户表：address -> {timestamp}
    contacts = {},  -- 联系人表：address1 -> {address2 -> true}
    messages = {},  -- 消息表：sessionId -> [{sender, content, timestamp, encrypted}]
    invitations = {} -- 邀请表：to_address -> {from_address -> {timestamp, status}}
  }
end

-- 工具函数
if not Handlers.utils then
  Handlers.utils = {}
end

function Handlers.utils.validateAddress(address)
  return type(address) == "string" and string.match(address, "^[a-zA-Z0-9_-]+$")
end

function Handlers.utils.createResponse(success, data, error)
  return { success = success, data = data, error = error }
end

function Handlers.utils.getSessionId(addr1, addr2)
  return addr1 < addr2 and addr1.."_"..addr2 or addr2.."_"..addr1
end

function Handlers.utils.userExists(address)
  return State.users[address] ~= nil
end

function Handlers.utils.areContacts(addr1, addr2)
  return State.contacts[addr1] and State.contacts[addr1][addr2] == true
end

function Handlers.utils.parseData(data)
  if type(data) == "string" then
    local success, parsed = pcall(function() return json.decode(data) end)
    if success and parsed then return parsed end
  end
  return data
end

-- 用户管理处理器
Handlers.add(
  "AddUser",
  Handlers.utils.hasMatchingTag("Action", "AddUser"),
  function(msg)
    local address = msg.From
    
    if State.users[address] then
      return Handlers.utils.createResponse(false, nil, "User already exists")
    end

    State.users[address] = { timestamp = os.time() }
    return Handlers.utils.createResponse(true, { user = State.users[address] })
  end
)

-- 联系人管理处理器
Handlers.add(
  "SendInvitation",
  Handlers.utils.hasMatchingTag("Action", "SendInvitation"),
  function(msg)
    local from = msg.From
    local data = Handlers.utils.parseData(msg.Data)
    
    if not from or not Handlers.utils.userExists(from) then
      return Handlers.utils.createResponse(false, nil, "Invalid or unregistered sender")
    end
    
    local to = data and data.to
    if not to or not Handlers.utils.validateAddress(to) then
      return Handlers.utils.createResponse(false, nil, "Invalid recipient address")
    end

    if not Handlers.utils.userExists(to) then
      return Handlers.utils.createResponse(false, nil, "Recipient not registered")
    end

    if Handlers.utils.areContacts(from, to) then
      return Handlers.utils.createResponse(false, nil, "Already contacts")
    end

    if State.invitations[to] and State.invitations[to][from] and 
       State.invitations[to][from].status == "pending" then
      return Handlers.utils.createResponse(false, nil, "Invitation already sent")
    end

    if not State.invitations[to] then
      State.invitations[to] = {}
    end

    State.invitations[to][from] = {
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

-- 1. 用户管理处理器
Handlers.add(
  "AddUser",
  Handlers.utils.hasMatchingTag("Action", "AddUser"),
  function(msg)
    local address = msg.From
    
    -- 检查用户是否已存在
    if State.users[address] then
      return Handlers.utils.createResponse(false, nil, "User already exists")
    end

    -- 存储用户数据
    State.users[address] = {
      timestamp = os.time()
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
    local data = Handlers.utils.parseData(msg.Data)  -- 确保正确解析数据
    
    -- 验证发送者地址
    if not from or not Handlers.utils.userExists(from) then
      return Handlers.utils.createResponse(false, nil, "Invalid or unregistered sender")
    end
    
    -- 获取接收者地址并验证
    local to = data and data.to
    if not to or not Handlers.utils.validateAddress(to) then
      return Handlers.utils.createResponse(false, nil, "Invalid recipient address")
    end

    -- 验证接收者是否已注册
    if not Handlers.utils.userExists(to) then
      return Handlers.utils.createResponse(false, nil, "Recipient not registered")
    end

    -- 检查是否已经是联系人
    if Handlers.utils.areContacts(from, to) then
      return Handlers.utils.createResponse(false, nil, "Already contacts")
    end

    -- 检查是否已经有待处理的邀请
    if State.invitations[to] and State.invitations[to][from] and 
       State.invitations[to][from].status == "pending" then
      return Handlers.utils.createResponse(false, nil, "Invitation already sent")
    end

    -- 初始化邀请表
    if not State.invitations[to] then
      State.invitations[to] = {}
    end

    -- 创建邀请
    State.invitations[to][from] = {
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
    State.contacts[from][to] = true
    State.contacts[to][from] = true

    -- 更新邀请状态
    State.invitations[to][from].status = "accepted"

    return Handlers.utils.createResponse(true, {
      from = from,
      to = to,
      timestamp = os.time()
    })
  end
)

-- 3. 消息管理处理器
Handlers.add(
  "SendMessage",
  Handlers.utils.hasMatchingTag("Action", "SendMessage"),
  function(msg)
    local sender = msg.From
    local data = Handlers.utils.parseData(msg.Data)
    local receiver = data.receiver
    local content = data.content
    local encrypted = data.encrypted or false
    local requestId = msg.Tags.Reference

    -- 验证地址
    if not Handlers.utils.validateAddress(sender) or not Handlers.utils.validateAddress(receiver) then
      ao.send({
        Target = sender,
        Action = "SendMessageResult",
        Tags = {
          ["Request-ID"] = requestId,
          ["Response-Type"] = "DirectResult"
        },
        Data = {
          success = false,
          error = "Invalid address format"
        }
      })
      return
    end

    -- 验证消息内容
    if not content or type(content) ~= "string" or #content == 0 then
      ao.send({
        Target = sender,
        Action = "SendMessageResult",
        Tags = {
          ["Request-ID"] = requestId,
          ["Response-Type"] = "DirectResult"
        },
        Data = {
          success = false,
          error = "Invalid message content"
        }
      })
      return
    end

    -- 检查是否为联系人
    if not Handlers.utils.areContacts(sender, receiver) then
      ao.send({
        Target = sender,
        Action = "SendMessageResult",
        Tags = {
          ["Request-ID"] = requestId,
          ["Response-Type"] = "DirectResult"
        },
        Data = {
          success = false,
          error = "Not contacts"
        }
      })
      return
    end

    -- 生成会话ID
    local sessionId = Handlers.utils.getSessionId(sender, receiver)

    -- 初始化会话
    if not State.messages[sessionId] then
      State.messages[sessionId] = {}
    end

    -- 添加消息
    local message = {
      sender = sender,
      content = content,
      encrypted = encrypted,
      timestamp = os.time()
    }
    table.insert(State.messages[sessionId], message)

    -- 发送直接响应
    ao.send({
      Target = sender,
      Action = "SendMessageResult",
      Tags = {
        ["Request-ID"] = requestId,
        ["Response-Type"] = "DirectResult"
      },
      Data = {
        success = true,
        data = {
          messageId = #State.messages[sessionId],
          timestamp = message.timestamp
        }
      }
    })
  end
)

Handlers.add(
  "GetMessages",
  Handlers.utils.hasMatchingTag("Action", "GetMessages"),
  function(msg)
    local address = msg.From
    local data = Handlers.utils.parseData(msg.Data)
    local otherAddress = data.otherAddress
    local requestId = msg.Tags.Reference

    -- 验证地址
    if not Handlers.utils.validateAddress(address) or not Handlers.utils.validateAddress(otherAddress) then
      ao.send({
        Target = address,
        Action = "GetMessagesResult",
        Tags = {
          ["Request-ID"] = requestId,
          ["Response-Type"] = "DirectResult"
        },
        Data = {
          success = false,
          error = "Invalid address format"
        }
      })
      return
    end

    -- 检查是否为联系人
    if not Handlers.utils.areContacts(address, otherAddress) then
      ao.send({
        Target = address,
        Action = "GetMessagesResult",
        Tags = {
          ["Request-ID"] = requestId,
          ["Response-Type"] = "DirectResult"
        },
        Data = {
          success = false,
          error = "Not contacts"
        }
      })
      return
    end

    -- 获取会话ID
    local sessionId = Handlers.utils.getSessionId(address, otherAddress)
    
    -- 获取消息历史
    local messages = State.messages[sessionId] or {}

    -- 发送直接响应
    ao.send({
      Target = address,
      Action = "GetMessagesResult",
      Tags = {
        ["Request-ID"] = requestId,
        ["Response-Type"] = "DirectResult"
      },
      Data = {
        success = true,
        data = {
          messages = messages
        }
      }
    })
  end
)

-- 4. 查询处理器
Handlers.add(
  "GetContacts",
  Handlers.utils.hasMatchingTag("Action", "GetContacts"),
  function(msg)
    local address = msg.From
    
    -- 验证地址
    if not Handlers.utils.validateAddress(address) then
      return Handlers.utils.reply(msg, {
        success = false,
        error = "Invalid address format"
      })
    end

    -- 获取联系人列表
    local contacts = {}
    if State.contacts[address] then
      for contactAddress, _ in pairs(State.contacts[address]) do
        -- 将每个联系人地址转换为联系人对象
        table.insert(contacts, {
          address = contactAddress,
          nickname = "User-" .. string.sub(contactAddress, 1, 6)  -- 临时昵称
        })
      end
    end

    -- 添加调试日志
    ao.send({
      Target = ao.id,
      Action = "Debug",
      Data = {
        handler = "GetContacts",
        from = address,
        contacts = contacts,
        state_contacts = State.contacts[address]
      }
    })

    -- 返回标准格式的响应
    return Handlers.utils.reply(msg, {
      success = true,
      data = {
        contacts = contacts
      }
    })
  end
)

Handlers.add(
  "GetPendingInvitations",
  Handlers.utils.hasMatchingTag("Action", "GetPendingInvitations"),
  function(msg)
    local address = msg.From
    local requestId = msg.Tags.Reference -- 使用消息的 Reference 作为请求ID

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
            timestamp = invitation.timestamp
          })
        end
      end
    end

    -- 发送直接响应给请求者
    ao.send({
      Target = address,
      Action = "GetPendingInvitationsResult",
      Tags = {
        ["Request-ID"] = requestId,
        ["Response-Type"] = "DirectResult"
      },
      Data = {
        success = true,
        data = {
          invitations = pendingInvitations
        }
      }
    })
  end
)

