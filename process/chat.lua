-- 初始化状态
if not Handlers.utils then
  Handlers.utils = {}
end

if not State then
  State = {
    chatInvitations = {},  -- 存储聊天室邀请
    chatrooms = {}         -- 存储聊天室信息
  }
end

-- 常量
local INVITATION_EXPIRE_DAYS = 7  -- 邀请7天后过期

-- 工具函数
function isExpired(timestamp)
  local now = os.time()
  return (now - timestamp) > (INVITATION_EXPIRE_DAYS * 24 * 60 * 60)
end

-- 改进 JSON 处理函数
local function encode(data)
  if ao and ao.json then
    -- 使用 ao.json，添加错误处理
    local success, result = pcall(function()
      return ao.json.encode(data)
    end)
    
    if success then
      -- 添加调试日志
      print("Successfully encoded data:", result)
      return result
    end
    -- 如果 ao.json.encode 失败，使用备选方案
    print("ao.json.encode failed, using fallback")
  end

  -- 改进的备选序列化方法
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

  -- 使用备选序列化方法
  local success, result = pcall(serialize, data)
  if success then
    print("Successfully encoded data using fallback:", result)
    return result
  end
  
  -- 如果所有方法都失败，返回基本的错误响应
  print("All encoding methods failed")
  return '{"success":false,"error":"Failed to encode response"}'
end

-- 发送聊天室邀请
Handlers.add(
  "SendChatroomInvitation",
  Handlers.utils.hasMatchingTag("Action", "SendChatroomInvitation"),
  function(msg)
    local from = msg.From
    local to = msg.Data.to
    local processId = msg.Data.processId

    -- 添加调试日志
    print("Processing chatroom invitation:")
    print("From:", from)
    print("To:", to)
    print("ProcessId:", processId)

    -- 验证参数
    if not processId then
      return encode({
        success = false,
        error = "Process ID is required"
      })
    end

    -- 初始化接收者的邀请列表
    if not State.chatInvitations[to] then
      State.chatInvitations[to] = {}
    end

    -- 检查是否已经存在相同的邀请
    for _, inv in ipairs(State.chatInvitations[to]) do
      if inv.processId == processId and inv.status == "pending" then
        return encode({
          success = false,
          error = "Invitation already exists"
        })
      end
    end

    -- 创建新邀请
    local invitation = {
      processId = processId,
      from = from,
      to = to,
      timestamp = os.time(),
      status = "pending"
    }

    -- 添加到邀请列表
    table.insert(State.chatInvitations[to], invitation)

    -- 添加调试日志
    print("Invitation created:", encode(invitation))

    return encode({
      success = true,
      invitation = invitation
    })
  end
)

-- 获取聊天室邀请
Handlers.add(
  "GetChatroomInvitations",
  Handlers.utils.hasMatchingTag("Action", "GetChatroomInvitations"),
  function(msg)
    local address = msg.From
    
    -- 添加调试日志
    print("Getting chatroom invitations for:", address)
    
    -- 获取该地址的所有待处理邀请
    local invitations = State.chatInvitations[address] or {}
    
    -- 过滤出未过期的待处理邀请
    local pendingInvitations = {}
    for _, inv in ipairs(invitations) do
      if inv.status == "pending" and not isExpired(inv.timestamp) then
        table.insert(pendingInvitations, inv)
      end
    end

    return encode({
      success = true,
      invitations = pendingInvitations
    })
  end
)

-- 接受聊天室邀请
Handlers.add(
  "AcceptChatroomInvitation",
  Handlers.utils.hasMatchingTag("Action", "AcceptChatroomInvitation"),
  function(msg)
    local address = msg.From
    local processId = msg.Data.processId
    
    -- 查找并更新邀请状态
    if State.chatInvitations[address] then
      for _, inv in ipairs(State.chatInvitations[address]) do
        if inv.processId == processId and inv.status == "pending" then
          if isExpired(inv.timestamp) then
            return encode({
              success = false,
              error = "Invitation has expired"
            })
          end

          inv.status = "accepted"
          
          -- 记录聊天室信息
          if not State.chatrooms[address] then
            State.chatrooms[address] = {}
          end
          table.insert(State.chatrooms[address], {
            processId = processId,
            joinedAt = os.time()
          })
          
          return encode({ success = true })
        end
      end
    end
    
    return encode({ 
      success = false, 
      error = "Invitation not found" 
    })
  end
)

-- 获取聊天室列表
Handlers.add(
  "GetChatrooms",
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

-- 添加调试处理器
Handlers.add(
  "DebugState",
  Handlers.utils.hasMatchingTag("Action", "DebugState"),
  function(msg)
    return ao.json.encode({
      success = true,
      state = {
        initialized = true,
        contacts = State.contacts,
        invitations = State.invitations
      }
    })
  end
)

-- 确保所有处理器都返回正确格式的JSON
Handlers.add(
  "GetContacts",
  Handlers.utils.hasMatchingTag("Action", "GetContacts"),
  function(msg)
    local address = msg.From
    local contacts = State.contacts[address] or {}

    -- 确保返回正确的JSON格式
    return ao.json.encode({
      success = true,
      contacts = contacts
    })
  end
) 