'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, CheckCircle2, Circle, Sparkles, Target, Zap, LogOut, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface Todo {
  id: string
  user_id: string
  text: string
  completed: boolean
  created_at: string
  updated_at: string
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputValue, setInputValue] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [todosLoading, setTodosLoading] = useState(false)

  // 用于跟踪本地操作的ref，避免实时订阅重复处理
  const localOperations = useRef<Set<string>>(new Set())

  // 创建supabase客户端实例
  const supabase = createClient()

  // 添加本地操作追踪
  const addLocalOperation = (id: string, operation: string) => {
    const operationKey = `${operation}_${id}`
    localOperations.current.add(operationKey)
    // 5秒后移除追踪，避免内存泄漏
    setTimeout(() => {
      localOperations.current.delete(operationKey)
    }, 5000)
  }

  // 检查是否是本地操作
  const isLocalOperation = (id: string, operation: string) => {
    const operationKey = `${operation}_${id}`
    return localOperations.current.has(operationKey)
  }

  // 获取用户的todos - 使用useCallback避免不必要的重新创建
  const fetchTodos = useCallback(async () => {
    if (!user) return

    setTodosLoading(true)
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching todos:', error)
        return
      }

      setTodos(data || [])
    } catch (error) {
      console.error('Error fetching todos:', error)
    } finally {
      setTodosLoading(false)
    }
  }, [user])

  useEffect(() => {
    // 获取当前用户
    const getUser = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    // 监听认证状态变化
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // 用户登录后获取todos
        fetchTodos()
      } else {
        // 用户登出后清空todos
        setTodos([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 当用户状态变化时获取todos并设置实时订阅
  useEffect(() => {
    let channel: any = null

    if (user) {
      // 获取初始数据
      fetchTodos()

      // 设置实时订阅
      channel = supabase
        .channel(`todos_${user.id}`) // 为每个用户创建唯一的频道
        .on(
          'postgres_changes',
          {
            event: '*', // 监听所有变更事件 (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'todos',
            filter: `user_id=eq.${user.id}` // 只监听当前用户的数据变更
          },
          (payload) => {
            console.log('Real-time change received:', payload)
            handleRealtimeChange(payload)
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status)
        })
    }

    // 清理函数
    return () => {
      if (channel) {
        console.log('Cleaning up realtime subscription')
        supabase.removeChannel(channel)
      }
    }
  }, [user?.id, fetchTodos])

  // 处理实时数据变更 - 只处理来自其他设备/会话的变更
  const handleRealtimeChange = (payload: any) => {
    console.log('Processing realtime change:', payload)
    const { eventType, new: newRecord, old: oldRecord } = payload

    switch (eventType) {
      case 'INSERT':
        // 检查是否是本地操作
        if (isLocalOperation(newRecord.id, 'INSERT')) {
          console.log('Skipping INSERT - local operation detected')
          return
        }
        
        // 只添加不存在的todo（来自其他设备）
        setTodos((currentTodos) => {
          const exists = currentTodos.find(todo => todo.id === newRecord.id)
          if (exists) {
            console.log('Todo already exists, skipping INSERT')
            return currentTodos
          }
          console.log('Adding new todo from realtime:', newRecord)
          return [newRecord, ...currentTodos]
        })
        break

      case 'UPDATE':
        // 检查是否是本地操作
        if (isLocalOperation(newRecord.id, 'UPDATE')) {
          console.log('Skipping UPDATE - local operation detected')
          return
        }
        
        // 更新todo
        setTodos((currentTodos) => {
          const existingTodo = currentTodos.find(todo => todo.id === newRecord.id)
          if (!existingTodo) {
            console.log('Todo not found for update, skipping')
            return currentTodos
          }

          console.log('Updating todo from realtime:', newRecord)
          return currentTodos.map((todo) =>
            todo.id === newRecord.id ? newRecord : todo
          )
        })
        break

      case 'DELETE':
        // 检查是否是本地操作
        if (isLocalOperation(oldRecord.id, 'DELETE')) {
          console.log('Skipping DELETE - local operation detected')
          return
        }
        
        // 删除todo
        setTodos((currentTodos) => {
          const exists = currentTodos.find(todo => todo.id === oldRecord.id)
          if (!exists) {
            console.log('Todo not found for delete, skipping')
            return currentTodos
          }
          console.log('Deleting todo from realtime:', oldRecord)
          return currentTodos.filter((todo) => todo.id !== oldRecord.id)
        })
        break

      default:
        console.log('Unknown event type:', eventType)
        break
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // 添加新的todo
  const addTodo = async () => {
    if (!inputValue.trim() || !user) return

    // 创建临时todo用于乐观更新
    const tempTodo: Todo = {
      id: `temp_${Date.now()}`, // 临时ID
      user_id: user.id,
      text: inputValue.trim(),
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 立即更新本地UI（乐观更新）
    setTodos(prevTodos => [tempTodo, ...prevTodos])
    setInputValue('')

    try {
      const { data, error } = await supabase
        .from('todos')
        .insert([
          {
            user_id: user.id,
            text: tempTodo.text,
            completed: false
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Error adding todo:', error)
        // 如果失败，移除临时todo
        setTodos(prevTodos => prevTodos.filter(todo => todo.id !== tempTodo.id))
        setInputValue(tempTodo.text) // 恢复输入框内容
        return
      }

      // 成功后，用真实数据替换临时数据
      setTodos(prevTodos => 
        prevTodos.map(todo => 
          todo.id === tempTodo.id ? data : todo
        )
      )
      
      // 追踪本地操作
      addLocalOperation(data.id, 'INSERT')
    } catch (error) {
      console.error('Error adding todo:', error)
      // 如果失败，移除临时todo
      setTodos(prevTodos => prevTodos.filter(todo => todo.id !== tempTodo.id))
      setInputValue(tempTodo.text) // 恢复输入框内容
    }
  }

  // 切换todo完成状态
  const toggleTodo = async (id: string) => {
    if (!user) return

    const todo = todos.find((t) => t.id === id)
    if (!todo) return

    // 立即更新本地UI（乐观更新）
    setTodos(prevTodos =>
      prevTodos.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      )
    )

    try {
      const { error } = await supabase
        .from('todos')
        .update({ completed: !todo.completed })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating todo:', error)
        // 如果失败，恢复原始状态
        setTodos(prevTodos =>
          prevTodos.map((t) =>
            t.id === id ? { ...t, completed: todo.completed } : t
          )
        )
        return
      }
      
      // 追踪本地操作
      addLocalOperation(id, 'UPDATE')
    } catch (error) {
      console.error('Error updating todo:', error)
      // 如果失败，恢复原始状态
      setTodos(prevTodos =>
        prevTodos.map((t) =>
          t.id === id ? { ...t, completed: todo.completed } : t
        )
      )
    }
  }

  // 删除todo
  const deleteTodo = async (id: string) => {
    if (!user) return

    // 保存要删除的todo用于错误恢复
    const todoToDelete = todos.find(t => t.id === id)
    if (!todoToDelete) return

    // 立即从UI中移除（乐观更新）
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id))

    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting todo:', error)
        // 如果失败，恢复删除的todo
        setTodos(prevTodos => [todoToDelete, ...prevTodos])
        return
      }
      
      // 追踪本地操作
      addLocalOperation(id, 'DELETE')
    } catch (error) {
      console.error('Error deleting todo:', error)
      // 如果失败，恢复删除的todo
      setTodos(prevTodos => [todoToDelete, ...prevTodos])
    }
  }

  const completedCount = todos.filter((todo) => todo.completed).length
  const totalCount = todos.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-amber-50">
      {/* Navigation Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6 text-cyan-600" />
              <h1 className="text-xl font-bold text-gray-800 font-sans">todo list</h1>
            </div>
            <div className="flex gap-3">
              {!loading && (
                <>
                  {user ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 font-sans">{user.email}</span>
                      <Button onClick={handleSignOut} size="sm" variant="outline" className="font-sans">
                        <LogOut className="w-4 h-4 mr-1" />
                        Logout
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button asChild size="sm" variant="outline" className="font-sans">
                        <Link href="/auth/login">Login</Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-sans"
                      >
                        <Link href="/auth/sign-up">Sign up</Link>
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Add Task Section - 只有登录用户才能看到 */}
        {user && (
          <Card className="p-8 mb-8 border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="What's next on your list?"
                  className="text-lg py-6 px-6 border-2 border-gray-200 focus:border-cyan-500 rounded-xl font-sans"
                  onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                  disabled={todosLoading}
                />
                <Zap className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              <Button
                onClick={addTodo}
                size="lg"
                className="px-8 py-6 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-sans"
                disabled={!inputValue.trim() || todosLoading}
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Task
              </Button>
            </div>
          </Card>
        )}

        {/* Tasks List */}
        <div className="space-y-4">
          {!user ? (
            <Card className="p-12 text-center border-0 shadow-lg bg-white/60 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-100 to-amber-100 rounded-full flex items-center justify-center">
                  <Target className="w-8 h-8 text-cyan-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 font-sans">Welcome to TodoList!</h3>
                <p className="text-gray-500 font-sans">Please login to start managing your todos</p>
              </div>
            </Card>
          ) : todosLoading ? (
            <Card className="p-12 text-center border-0 shadow-lg bg-white/60 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-100 to-amber-100 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 font-sans">Loading your todos...</h3>
                <p className="text-gray-500 font-sans">Please wait while we fetch your tasks</p>
              </div>
            </Card>
          ) : todos.length === 0 ? (
            <Card className="p-12 text-center border-0 shadow-lg bg-white/60 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-100 to-amber-100 rounded-full flex items-center justify-center">
                  <Target className="w-8 h-8 text-cyan-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 font-sans">Ready to get started?</h3>
                <p className="text-gray-500 font-sans">Add your first task above and begin your productive journey!</p>
              </div>
            </Card>
          ) : (
            todos.map((todo, index) => (
              <Card
                key={todo.id}
                className={`p-6 border-0 shadow-lg transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 ${
                  todo.completed
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-500'
                    : 'bg-white/80 backdrop-blur-sm border-l-4 border-l-cyan-500'
                }`}
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="flex-shrink-0 transition-all duration-200 hover:scale-110"
                  >
                    {todo.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-400 hover:text-cyan-600" />
                    )}
                  </button>

                  <div className="flex-1">
                    <p
                      className={`text-lg font-sans transition-all duration-200 ${
                        todo.completed ? 'text-gray-500 line-through' : 'text-gray-800'
                      }`}
                    >
                      {todo.text}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-sans">
                      {new Date(todo.created_at).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  <Button
                    onClick={() => deleteTodo(todo.id)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Progress Section */}
        {user && todos.length > 0 && (
          <Card className="mt-8 p-6 border-0 shadow-lg bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 font-sans">Progress</h3>
                <p className="text-gray-600 font-sans">
                  {completedCount} of {totalCount} tasks completed
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-amber-600">
                  {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
                </div>
                <div className="w-24 h-2 bg-gray-200 rounded-full mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
