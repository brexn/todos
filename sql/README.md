# TodoList 数据库设置指南

## 数据库表结构

### todos 表

该表用于存储用户的待办事项，具有以下字段：

- `id`: UUID类型主键，自动生成
- `user_id`: UUID类型，关联到 `auth.users` 表，标识待办事项的所有者
- `text`: TEXT类型，待办事项的内容
- `completed`: BOOLEAN类型，标识是否已完成，默认为false
- `created_at`: TIMESTAMP类型，创建时间，自动设置为当前UTC时间
- `updated_at`: TIMESTAMP类型，更新时间，每次更新时自动更新

## RLS（行级安全）策略

为了确保用户只能访问自己的待办事项，我们实现了以下RLS策略：

1. **SELECT策略**: 用户只能查看自己创建的todos
2. **INSERT策略**: 用户只能创建属于自己的todos
3. **UPDATE策略**: 用户只能更新自己的todos
4. **DELETE策略**: 用户只能删除自己的todos

## 如何使用

### 1. 在Supabase中执行SQL

1. 登录到您的Supabase项目控制台
2. 进入"SQL Editor"
3. 复制并执行 `create_todos_table.sql` 中的SQL语句

### 2. 验证表创建

执行以下查询来验证表是否正确创建：

```sql
-- 查看表结构
\d todos

-- 查看RLS策略
SELECT * FROM pg_policies WHERE tablename = 'todos';
```

### 3. 测试RLS策略

您可以通过以下方式测试RLS策略是否正常工作：

1. 确保有已登录的用户
2. 尝试插入一条todo记录
3. 验证只能看到自己的记录

## 实时功能

该应用已启用Supabase实时功能，支持多设备间的数据同步：

### 实时特性
- **自动同步**: 用户在任何设备上的操作（增加、修改、删除）都会实时同步到其他设备
- **用户隔离**: 只会接收到当前用户自己的数据变更，不会看到其他用户的操作
- **事件监听**: 监听所有数据库变更事件（INSERT、UPDATE、DELETE）

### 实现原理
1. 通过 `ALTER PUBLICATION supabase_realtime ADD TABLE todos;` 启用表的实时功能
2. 前端订阅特定用户的数据变更：`filter: user_id=eq.${user.id}`
3. 自动处理实时事件并更新本地状态

## 注意事项

- 所有的RLS策略都基于 `auth.uid()` 函数，确保用户已通过Supabase认证
- `user_id` 字段通过外键约束关联到 `auth.users` 表
- 当用户被删除时，其所有的todos也会被级联删除
- `updated_at` 字段会在每次更新记录时自动更新为当前时间
- **实时功能**: 需要确保Supabase项目已启用实时功能，并执行了实时发布命令
