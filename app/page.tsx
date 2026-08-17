"use client"

import { useState, useEffect } from "react"
import { Play, Pause, Plus, Zap, Gamepad2, Download, FileSpreadsheet, FileText, Wifi, WifiOff } from "lucide-react"
import jsPDF from "jspdf"
import { exportToCSV } from "../utils/export-utils"
import DottedBackground from "@/components/dotted-background"

interface Task {
  id: string
  name: string
  category: "criacao" | "ajustes"
  totalTime: number
  currentTime: number
  isRunning: boolean
  createdAt?: string
}

export default function TodoTimerApp() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskName, setNewTaskName] = useState("")
  const [newTaskCategory, setNewTaskCategory] = useState<"criacao" | "ajustes">("criacao")
  const [isOnline, setIsOnline] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set())

  // Verificar conectividade
  useEffect(() => {
    const checkOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', checkOnlineStatus)
    window.addEventListener('offline', checkOnlineStatus)
    checkOnlineStatus()

    return () => {
      window.removeEventListener('online', checkOnlineStatus)
      window.removeEventListener('offline', checkOnlineStatus)
    }
  }, [])

  // Função para parar todas as tarefas
  const stopAllTasks = () => {
    setRunningTasks(new Set())
    setTasks((prevTasks) =>
      prevTasks.map((task) => ({
        ...task,
        isRunning: false,
        totalTime: task.totalTime + task.currentTime,
        currentTime: 0
      }))
    )
  }

  // Função para parar uma tarefa específica
  const stopTask = (taskId: string) => {
    setRunningTasks((prev) => {
      const newSet = new Set(prev)
      newSet.delete(taskId)
      return newSet
    })

    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            isRunning: false,
            totalTime: task.totalTime + task.currentTime,
            currentTime: 0
          }
        }
        return task
      })
    )
  }

  // Carregar tarefas do backend
  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      setIsLoading(true)
      // Parar todas as tarefas antes de carregar
      stopAllTasks()

      const response = await fetch('/api/tasks')
      if (response.ok) {
        const data = await response.json()
        // Garantir que as tarefas carregadas não estejam rodando
        const tasksWithoutRunning = (data.tasks || []).map((task: Task) => ({
          ...task,
          isRunning: false,
          currentTime: 0
        }))
        setTasks(tasksWithoutRunning)
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addTask = async () => {
    if (newTaskName.trim() !== "") {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newTaskName.trim(),
            category: newTaskCategory,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setTasks([...tasks, data.task])
          setNewTaskName("")
        }
      } catch (error) {
        console.error('Erro ao adicionar tarefa:', error)
        // Fallback para modo offline
        const newTask: Task = {
          id: Date.now().toString(),
          name: newTaskName.trim(),
          category: newTaskCategory,
          totalTime: 0,
          currentTime: 0,
          isRunning: false,
        }
        setTasks([...tasks, newTask])
        setNewTaskName("")
      }
    }
  }

  const removeTask = async (taskId: string) => {
    // Parar tarefa se estiver rodando
    stopTask(taskId)

    setTasks((prevTasks) => {
      return prevTasks.filter((task) => task.id !== taskId)
    })

    try {
      await fetch(`/api/tasks?id=${taskId}`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('Erro ao remover tarefa:', error)
    }
  }

  const toggleTimer = async (taskId: string) => {
    setTasks((prevTasks) => {
      return prevTasks.map((task) => {
        if (task.id === taskId) {
          if (task.isRunning) {
            // Parar o cronômetro
            stopTask(taskId)
            const updatedTask = {
              ...task,
              isRunning: false,
              totalTime: task.totalTime + task.currentTime,
              currentTime: 0,
            }

            // Salvar no backend
            updateTaskInBackend(taskId, updatedTask)

            return updatedTask
          } else {
            // Iniciar o cronômetro
            setRunningTasks((prev) => {
              const newSet = new Set(prev)
              newSet.add(taskId)
              return newSet
            })

            const updatedTask = {
              ...task,
              isRunning: true,
            }

            // Salvar no backend
            updateTaskInBackend(taskId, updatedTask)

            return updatedTask
          }
        }
        return task
      })
    })
  }

  const updateTaskInBackend = async (taskId: string, updates: any) => {
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: taskId,
          updates,
        }),
      })
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getTotalTimeForTask = (task: Task) => {
    return task.totalTime + task.currentTime
  }

  const criacaoTasks = tasks.filter((task) => task.category === "criacao")
  const ajustesTasks = tasks.filter((task) => task.category === "ajustes")

  // Função para exportar para Excel
  const exportToExcel = () => {
    exportToCSV(tasks, formatTime)
  }

  // Função para exportar para PDF
  const exportToPDF = () => {
    const doc = new jsPDF()

    // Título
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.text("LISTA DO RAFA - RELATÓRIO DE TAREFAS", 20, 30)

    // Data
    const today = new Date().toLocaleDateString("pt-BR")
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(`Data: ${today}`, 20, 45)

    let yPosition = 65

    // Seção Criação
    if (criacaoTasks.length > 0) {
      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.text("🎨 CRIAÇÃO", 20, yPosition)
      yPosition += 15

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")

      criacaoTasks.forEach((task) => {
        if (yPosition > 270) {
          doc.addPage()
          yPosition = 30
        }
        doc.text(`• ${task.name}`, 25, yPosition)
        doc.text(`Tempo: ${formatTime(getTotalTimeForTask(task))}`, 140, yPosition)
        yPosition += 10
      })

      yPosition += 10
    }

    // Seção Ajustes
    if (ajustesTasks.length > 0) {
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 30
      }

      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.text("⚙️ AJUSTES", 20, yPosition)
      yPosition += 15

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")

      ajustesTasks.forEach((task) => {
        if (yPosition > 270) {
          doc.addPage()
          yPosition = 30
        }
        doc.text(`• ${task.name}`, 25, yPosition)
        doc.text(`Tempo: ${formatTime(getTotalTimeForTask(task))}`, 140, yPosition)
        yPosition += 10
      })

      yPosition += 15
    }

    // Resumo
    if (yPosition > 220) {
      doc.addPage()
      yPosition = 30
    }

    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("🏆 ESTATÍSTICAS FINAIS", 20, yPosition)
    yPosition += 20

    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(
      `Tempo em Criação: ${formatTime(criacaoTasks.reduce((total, task) => total + getTotalTimeForTask(task), 0))}`,
      25,
      yPosition,
    )
    yPosition += 15
    doc.text(
      `Tempo em Ajustes: ${formatTime(ajustesTasks.reduce((total, task) => total + getTotalTimeForTask(task), 0))}`,
      25,
      yPosition,
    )
    yPosition += 15
    doc.setFont("helvetica", "bold")
    doc.text(
      `TEMPO TOTAL: ${formatTime(tasks.reduce((total, task) => total + getTotalTimeForTask(task), 0))}`,
      25,
      yPosition,
    )

    // Footer
    doc.setFontSize(8)
    doc.setFont("helvetica", "italic")
    doc.text("Gerado pela Lista do Rafa - sempre da merda", 20, 285)

    doc.save(`Lista_do_Rafa_${today.replace(/\//g, "-")}.pdf`)
  }

  // Timer principal que gerencia todos os cronômetros
  useEffect(() => {
    if (runningTasks.size === 0) return

    const interval = setInterval(() => {
      setTasks((prevTasks) => {
        return prevTasks.map((task) => {
          if (runningTasks.has(task.id) && task.isRunning) {
            return { ...task, currentTime: task.currentTime + 1 }
          }
          return task
        })
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [runningTasks])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllTasks()
    }
  }, [])

  const renderTask = (task: Task, accent: "purple" | "red") => (
    <div key={task.id} className={`p-4 task-card task-card-${accent}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[140px]">
          <h3 className="font-bold text-white ng-font text-lg">{task.name}</h3>
          <p className={`text-sm ng-font ${accent === "purple" ? "text-purple-400" : "text-red-400"}`}>
            ⏱️ Total: {formatTime(getTotalTimeForTask(task))}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`timer-display timer-${accent} ${task.isRunning ? "timer-running" : ""} px-4 py-2`}>
            <span className="text-2xl font-mono font-bold">{formatTime(getTotalTimeForTask(task))}</span>
          </div>

          <button
            onClick={() => toggleTimer(task.id)}
            className={`round-btn ${task.isRunning ? "round-btn-red" : "round-btn-purple"}`}
            aria-label={task.isRunning ? "Pausar" : "Iniciar"}
          >
            {task.isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button onClick={() => removeTask(task.id)} className="trash-btn" aria-label="Excluir tarefa">
            <svg viewBox="0 0 448 512" className="svgIcon">
              <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* Fundo animado dot matrix */}
      <DottedBackground
        bgColor="#08060d"
        colors={["#1b123044", "#9f3dff55", "#ff454555"]}
        style={{ position: "fixed", inset: 0, zIndex: 0 }}
      />

      {/* Loader de quadrados */}
      {isLoading && (
        <div className="loader-overlay">
          <div className="loader">
            <div className="square" id="sq1"></div>
            <div className="square" id="sq2"></div>
            <div className="square" id="sq3"></div>
            <div className="square" id="sq4"></div>
            <div className="square" id="sq5"></div>
            <div className="square" id="sq6"></div>
            <div className="square" id="sq7"></div>
            <div className="square" id="sq8"></div>
            <div className="square" id="sq9"></div>
          </div>
        </div>
      )}

      <div className="relative z-10 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 p-6 neon-card neon-header">
            <div className="flex items-center gap-4">
              <Gamepad2 className="w-10 h-10 text-purple-400 drop-shadow-[0_0_10px_rgba(159,61,255,0.7)]" />
              <h1 className="text-4xl font-black ng-font neon-title">LISTA DO RAFA</h1>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-purple-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
              <span className="text-xs text-gray-400">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Formulário */}
          <div className="mb-8 p-6 neon-card">
            <div className="flex items-center gap-3 mb-4">
              <Plus className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-purple-400 ng-font">NOVA TAREFA</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <input
                type="text"
                placeholder="Digite o nome da tarefa..."
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addTask()
                  }
                }}
                className="flex-1 neon-input ng-font"
              />

              {/* Radio glider de categoria */}
              <div className="radio-container ng-font">
                <input
                  checked={newTaskCategory === "criacao"}
                  onChange={() => setNewTaskCategory("criacao")}
                  id="radio-criacao"
                  name="category"
                  type="radio"
                />
                <label htmlFor="radio-criacao">🎨 Criação</label>
                <input
                  checked={newTaskCategory === "ajustes"}
                  onChange={() => setNewTaskCategory("ajustes")}
                  id="radio-ajustes"
                  name="category"
                  type="radio"
                />
                <label htmlFor="radio-ajustes">⚙️ Ajustes</label>

                <div className="glider-container">
                  <div className="glider"></div>
                </div>
              </div>

              <button
                onClick={addTask}
                disabled={isLoading}
                className="px-6 py-3 add-btn font-bold ng-font w-full sm:w-auto disabled:opacity-50"
              >
                {isLoading ? 'ADICIONANDO...' : 'ADICIONAR'}
              </button>
            </div>
          </div>

          {/* Grid de colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Coluna Criação */}
            <div className="neon-card overflow-hidden">
              <div className="section-header section-purple">
                <span className="text-2xl">🎨</span>
                <h2 className="text-2xl font-black ng-font">CRIAÇÃO ({criacaoTasks.length})</h2>
              </div>
              <div className="p-4 space-y-4">
                {criacaoTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <Zap className="w-12 h-12 text-purple-400/50 mx-auto mb-2" />
                    <p className="text-gray-400 ng-font">Se aqui estiver vazio... fudeu big friend</p>
                  </div>
                ) : (
                  criacaoTasks.map((task) => renderTask(task, "purple"))
                )}
              </div>
            </div>

            {/* Coluna Ajustes */}
            <div className="neon-card overflow-hidden">
              <div className="section-header section-red">
                <span className="text-2xl">⚙️</span>
                <h2 className="text-2xl font-black ng-font">AJUSTES ({ajustesTasks.length})</h2>
              </div>
              <div className="p-4 space-y-4">
                {ajustesTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <Zap className="w-12 h-12 text-red-400/50 mx-auto mb-2" />
                    <p className="text-gray-400 ng-font">Nenhum B.O até agr , bizarro</p>
                  </div>
                ) : (
                  ajustesTasks.map((task) => renderTask(task, "red"))
                )}
              </div>
            </div>
          </div>

          {/* Resumo */}
          {tasks.length > 0 && (
            <div className="mt-8 neon-card overflow-hidden">
              <div className="section-header section-purple justify-center">
                <h2 className="text-2xl font-black ng-font text-center">🏆 ESTATÍSTICAS FINAIS 🏆</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="text-center task-card task-card-purple p-6">
                    <div className="text-4xl font-black ng-font mb-2 stat-value-purple">
                      {formatTime(criacaoTasks.reduce((total, task) => total + getTotalTimeForTask(task), 0))}
                    </div>
                    <p className="text-purple-300 font-bold ng-font">🎨 CRIAÇÃO</p>
                  </div>
                  <div className="text-center task-card task-card-red p-6">
                    <div className="text-4xl font-black ng-font mb-2 stat-value-red">
                      {formatTime(ajustesTasks.reduce((total, task) => total + getTotalTimeForTask(task), 0))}
                    </div>
                    <p className="text-red-300 font-bold ng-font">⚙️ AJUSTES</p>
                  </div>
                  <div className="text-center task-card task-card-purple p-6">
                    <div className="text-4xl font-black ng-font mb-2 neon-title">
                      {formatTime(tasks.reduce((total, task) => total + getTotalTimeForTask(task), 0))}
                    </div>
                    <p className="text-gray-300 font-bold ng-font">🔥 TOTAL</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Exportação */}
          {tasks.length > 0 && (
            <div className="mt-8 text-center">
              <div className="neon-card p-6">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Download className="w-6 h-6 text-purple-400" />
                  <h3 className="text-2xl font-bold text-purple-400 ng-font">EXPORTAR DADOS</h3>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button onClick={exportToExcel} className="neon-btn neon-btn-purple ng-font">
                    <FileSpreadsheet className="w-5 h-5" />
                    CSV/EXCEL (.csv)
                  </button>

                  <button onClick={exportToPDF} className="neon-btn neon-btn-red ng-font">
                    <FileText className="w-5 h-5" />
                    PDF (.pdf)
                  </button>
                </div>

                <p className="text-gray-400 text-sm mt-4 ng-font">📊 Exporte teste aaaa</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-[#6b6480] ng-font">⚡ LISTA DO RAFA - sempre da merda ⚡</p>
          </div>
        </div>
      </div>
    </div>
  )
}
