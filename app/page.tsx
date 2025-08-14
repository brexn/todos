'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, CheckCircle2, Circle, Sparkles, Target, Zap } from 'lucide-react'

interface Todo {
  id: number
  text: string
  completed: boolean
  createdAt: Date
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputValue, setInputValue] = useState('')

  const addTodo = () => {
    if (inputValue.trim()) {
      const newTodo: Todo = {
        id: Date.now(),
        text: inputValue.trim(),
        completed: false,
        createdAt: new Date()
      }
      setTodos([newTodo, ...todos])
      setInputValue('')
    }
  }

  const toggleTodo = (id: number) => {
    setTodos(todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)))
  }

  const deleteTodo = (id: number) => {
    setTodos(todos.filter((todo) => todo.id !== id))
  }

  const completedCount = todos.filter((todo) => todo.completed).length
  const totalCount = todos.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-amber-50">
      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Add Task Section */}
        <Card className="p-8 mb-8 border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="What's next on your list?"
                className="text-lg py-6 px-6 border-2 border-gray-200 focus:border-cyan-500 rounded-xl font-sans"
                onKeyPress={(e) => e.key === 'Enter' && addTodo()}
              />
              <Zap className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <Button
              onClick={addTodo}
              size="lg"
              className="px-8 py-6 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-sans"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Task
            </Button>
          </div>
        </Card>

        {/* Tasks List */}
        <div className="space-y-4">
          {todos.length === 0 ? (
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
                      {todo.createdAt.toLocaleDateString('zh-CN', {
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
        {todos.length > 0 && (
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
