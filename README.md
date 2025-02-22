# 社区投票系统

基于 Solana 钱包的社区投票系统，支持 STONKS 代币投票权重。

## 功能特点

- 支持 Solana 钱包连接
- 基于 STONKS 代币余额的投票权重
- 投票主题状态管理（即将开始、进行中、已结束）
- 防重复投票和并发控制
- 完整的投票记录查询

## 技术栈

- 前端：HTML + CSS + JavaScript (jQuery)
- 后端：Node.js + Express
- 数据库：MySQL
- 区块链：Solana

## 快速开始

### 1. 环境要求

- Node.js >= 14
- MySQL >= 5.7
- Solana 钱包（如 Phantom）

### 2. 安装步骤

1. 克隆项目
```bash
git clone <repository_url>
cd <project_directory>
```

2. 安装依赖
```bash
npm install
```

3. 配置数据库
```bash
mysql -u root -p < vote_system.sql
```

4. 配置环境
```bash
cp config.example.json config.json
```
编辑 config.json，填入正确的配置信息

5. 启动服务
```bash
npm start
```

## API 文档

### Common Response Format
All APIs follow this response format:
```typescript
{
    code: number;      // Error code, 0 means success
    data: any;        // Response data
    message?: string; // Error message if code !== 0
}
```

### 1. Get Topics List

**Request Method:** GET

**Interface Path:** `/api/topics`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status: upcoming, active, ended |

**Response Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| code | number | Error code, 0 means success |
| data | array | Topics list |
| data[].id | number | Topic ID |
| data[].title | string | Topic title |
| data[].start_time | datetime | Start time |
| data[].end_time | datetime | End time |
| data[].created_at | datetime | Creation time |

**Response Type:**
```typescript
interface Response {
    code: number;
    data: Array<{
        id: number;
        title: string;
        start_time: string;  // ISO datetime
        end_time: string;    // ISO datetime
        created_at: string;  // ISO datetime
    }>;
}
```

**Response Example:**
```json
{
    "code": 0,
    "data": [
        {
            "id": 1,
            "title": "Sample Topic",
            "start_time": "2024-01-01T00:00:00Z",
            "end_time": "2024-01-07T00:00:00Z",
            "created_at": "2023-12-31T00:00:00Z"
        }
    ]
}
```

### 2. Get Topic Details

**Request Method:** GET

**Interface Path:** `/api/topics/:id`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Topic ID |

**Response Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| topic | object | Topic information |
| topic.id | number | Topic ID |
| topic.title | string | Topic title |
| topic.start_time | datetime | Start time |
| topic.end_time | datetime | End time |
| topic.created_at | datetime | Creation time |
| options | array | Options list |
| options[].id | number | Option ID |
| options[].option_text | string | Option text |
| options[].vote_count | string | Vote count (BigInt as string) |

**Response Type:**
```typescript
interface Response {
    code: number;
    data: {
        topic: {
            id: number;
            title: string;
            start_time: string;  // ISO datetime
            end_time: string;    // ISO datetime
            created_at: string;  // ISO datetime
        };
        options: Array<{
            id: number;
            option_text: string;
            vote_count: string;  // BigInt as string
        }>;
    };
}
```

**Response Example:**
```json
{
    "code": 0,
    "data": {
        "topic": {
            "id": 1,
            "title": "Sample Topic",
            "start_time": "2024-01-01T00:00:00Z",
            "end_time": "2024-01-07T00:00:00Z",
            "created_at": "2023-12-31T00:00:00Z"
        },
        "options": [
            {
                "id": 1,
                "option_text": "Option A",
                "vote_count": "1000000000000000000"
            }
        ]
    }
}
```

**注意事项：**
- 仅返回启用中的主题（is_active = 1）
- 投票数量以字符串形式返回，以保留BigInt精度
- 如果主题不存在或未启用，返回错误码TOPIC_NOT_FOUND

### 3. Submit Vote

**Request Method:** POST

**Interface Path:** `/api/vote`

**Request Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| topicId | number | Yes | Topic ID |
| optionId | number | Yes | Option ID |
| walletAddress | string | Yes | Wallet address |
| message | string | Yes | Message to sign |
| signature | string | Yes | Base58 encoded signature |

**Response Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| code | number | Error code, 0 means success |
| data.message | string | Success message |

**Request Type:**
```typescript
interface Request {
    topicId: number;
    optionId: number;
    walletAddress: string;
    message: string;      // Message to sign
    signature: string;    // Base58 encoded signature
}
```

**Response Type:**
```typescript
interface Response {
    code: number;
    data: {
        message: string;
    };
}
```

**Response Example:**
```json
{
    "code": 0,
    "data": {
        "message": "Vote submitted successfully"
    }
}
```

### 4. Get Topic Vote Records

**Request Method:** GET

**Interface Path:** `/api/topics/:id/records`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Topic ID |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sort | string | No | Sort by: amount (default) or time |

**Response Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| code | number | Error code, 0 means success |
| data | array | Vote records list |
| data[].id | number | Record ID |
| data[].topic_id | number | Topic ID |
| data[].option_id | number | Option ID |
| data[].wallet_address | string | Voter's wallet address |
| data[].vote_amount | string | Vote amount (BigInt as string) |
| data[].created_at | datetime | Vote time |
| data[].option_text | string | Option text |

**Response Type:**
```typescript
interface Response {
    code: number;
    data: Array<{
        id: number;
        topic_id: number;
        option_id: number;
        wallet_address: string;
        vote_amount: string;     // BigInt as string
        created_at: string;      // ISO datetime
        option_text: string;
    }>;
}
```

**Response Example:**
```json
{
    "code": 0,
    "data": [
        {
            "id": 1,
            "topic_id": 1,
            "option_id": 1,
            "wallet_address": "8xk3h...9j2h",
            "vote_amount": "1000000000000000000",
            "created_at": "2024-01-01T12:00:00Z",
            "option_text": "Option A"
        }
    ]
}
```

### 5. Get Wallet Vote Record

**Request Method:** GET

**Interface Path:** `/api/topics/:id/wallet/:address`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Topic ID |
| address | string | Yes | Wallet address |

**Response Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| code | number | Error code, 0 means success |
| data | object\|null | Vote record (null if not voted) |
| data.id | number | Record ID |
| data.topic_id | number | Topic ID |
| data.option_id | number | Option ID |
| data.wallet_address | string | Voter's wallet address |
| data.vote_amount | string | Vote amount (BigInt as string) |
| data.created_at | datetime | Vote time |
| data.option_text | string | Option text |

**Response Type:**
```typescript
interface Response {
    code: number;
    data: {
        id: number;
        topic_id: number;
        option_id: number;
        wallet_address: string;
        vote_amount: string;     // BigInt as string
        created_at: string;      // ISO datetime
        option_text: string;
    } | null;
}
```

**Response Example:**
```json
{
    "code": 0,
    "data": {
        "id": 1,
        "topic_id": 1,
        "option_id": 1,
        "wallet_address": "8xk3h...9j2h",
        "vote_amount": "1000000000000000000",
        "created_at": "2024-01-01T12:00:00Z",
        "option_text": "Option A"
    }
}
```

## 注意事项

1. 需要确保 STONKS 代币地址配置正确
2. 投票需要钱包中 STONKS 余额大于 100
3. 每个地址对每个主题只能投票一次
4. 投票权重与 STONKS 余额相等
5. 投票主题有时间和状态限制

## 许可证

MIT License

### Error Codes

All APIs may return the following error codes in the response:

| Code | Message | Description |
|------|---------|-------------|
| 0 | Success | Operation completed successfully |
| 1001 | Topic not found | Topic does not exist |
| 1002 | Topic not in time | Topic is not in voting period |
| 1003 | Already voted | Wallet has already voted for this topic |
| 1004 | Insufficient balance | STONKS token balance is less than required (100) |
| 1005 | Invalid option | Option ID does not exist or does not belong to the topic |
| 1006 | System error | Internal server error |
| 1007 | Concurrent operation | Another voting operation is in progress |
| 1008 | Invalid signature | Signature verification failed |
| 1009 | Database error | Database operation failed |

**Error Response Example:**
```json
{
    "code": 1003,
    "message": "Already voted",
    "data": null
}
```

**Error Response Type:**
```typescript
interface ErrorResponse {
    code: number;      // Error code, non-zero indicates error
    message: string;   // Error message
    data: null;        // No data for error responses
}
```

**Notes:**
- All error responses will have a non-zero code
- The message field provides a human-readable description of the error
- The data field will be null for error responses
- Frontend should handle these error codes appropriately
