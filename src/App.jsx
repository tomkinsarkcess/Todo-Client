import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const App = () => {
  const [todos, setTodos] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [editTask, setEditTask] = useState('');
  const [editId, setEditId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [modalAnimation, setModalAnimation] = useState('');
  const [serverStatus, setServerStatus] = useState('checking');
  const [darkMode, setDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [showAddForm, setShowAddForm] = useState(true);
  
  // Animation states
  const [newTaskId, setNewTaskId] = useState(null);
  const [deletedTaskId, setDeletedTaskId] = useState(null);
  const [completedTaskId, setCompletedTaskId] = useState(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  
  // Enhanced filter states
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  
  // Task templates
  const [showTemplates, setShowTemplates] = useState(false);
  const taskTemplates = [
    { task: "Morning exercise", priority: "high", dueDateOffset: 1 },
    { task: "Team meeting", priority: "medium", dueDateOffset: 0 },
    { task: "Project deadline", priority: "high", dueDateOffset: 7 },
    { task: "Grocery shopping", priority: "low", dueDateOffset: 2 },
    { task: "Read a book", priority: "low", dueDateOffset: 3 }
  ];
  
  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    overdue: true,
    today: true,
    tomorrow: true,
    thisWeek: true,
    later: true,
    noDate: true
  });
  
  const API_URL = import.meta.env.VITE_API_URL || 'https://todo-server-mongodb.onrender.com';
  const todoToDeleteRef = useRef(null);
  
  // Refs for input elements
  const newTaskInputRef = useRef(null);
  const searchInputRef = useRef(null);
  
  // Dark mode
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
  }, []);
  
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  // Set default due date
  useEffect(() => {
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 16);
    setDueDate(formattedDate);
  }, []);
  
  // Notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
  
  // Reminders
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      todos.forEach(todo => {
        if (todo.dueDate && !todo.completed) {
          const dueDate = new Date(todo.dueDate);
          const timeDiff = dueDate.getTime() - now.getTime();
          
          if (timeDiff > 0 && timeDiff <= 600000 && !todo.notified) {
            const updatedTodos = todos.map(t => 
              t.id === todo.id ? { ...t, notified: true } : t
            );
            setTodos(updatedTodos);
            saveTodosToLocalStorage(updatedTodos);
            
            if (Notification.permission === 'granted') {
              new Notification('Task Due Soon', {
                body: `"${capitalizeFirstWord(todo.task)}" is due in ${Math.floor(timeDiff / 60000)} minutes!`,
                icon: '/favicon.ico'
              });
            }
          }
        }
      });
    };
    const reminderInterval = setInterval(checkReminders, 60000);
    return () => clearInterval(reminderInterval);
  }, [todos]);
  
  // Initialize
  useEffect(() => {
    cleanLocalStorageTodos();
    checkServerStatus();
    fetchTodos();
  }, []);
  
  const checkServerStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/todos`);
      if (response.ok) {
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch (error) {
      console.error('Server status check failed:', error);
      setServerStatus('offline');
    }
  };
  
  const fetchTodos = async () => {
    try {
      const response = await fetch(`${API_URL}/todos`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      
      const localTodos = localStorage.getItem('todos');
      let mergedTodos = data;
      
      if (localTodos) {
        const parsedLocalTodos = JSON.parse(localTodos);
        mergedTodos = data.map(serverTodo => {
          const localTodo = parsedLocalTodos.find(t => t.id === serverTodo.id);
          return localTodo || { 
            ...serverTodo, 
            completed: false, 
            dueDate: '', 
            priority: 'medium', 
            notified: false 
          };
        });
      } else {
        mergedTodos = data.map(todo => ({
          ...todo,
          completed: false,
          dueDate: '',
          priority: 'medium',
          notified: false
        }));
      }
      
      setTodos(mergedTodos);
    } catch (error) {
      console.error('Error fetching todos:', error);
      const localTodos = localStorage.getItem('todos');
      if (localTodos) {
        const parsedTodos = JSON.parse(localTodos).map(todo => ({
          ...todo,
          id: todo.id || Date.now()
        }));
        setTodos(parsedTodos);
      }
      showModal('error', `Failed to fetch tasks: ${error.message}. Using local storage as fallback.`);
    }
  };
  
  const cleanLocalStorageTodos = () => {
    const localTodos = localStorage.getItem('todos');
    if (localTodos) {
      try {
        const parsedTodos = JSON.parse(localTodos);
        const cleanedTodos = parsedTodos
          .filter(todo => todo.id)
          .map(todo => ({
            ...todo,
            id: todo.id || Date.now()
          }));
        localStorage.setItem('todos', JSON.stringify(cleanedTodos));
      } catch (error) {
        console.error('Error cleaning localStorage todos:', error);
      }
    }
  };
  
  const saveTodosToLocalStorage = (todosList) => {
    localStorage.setItem('todos', JSON.stringify(todosList));
  };
  
  const capitalizeFirstWord = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
  
  const handleAdd = async () => {
    if (!newTask.trim()) {
      showModal('validation', 'Please enter a valid task.');
      return;
    }
    if (todos.some(todo => todo.task.toLowerCase() === newTask.toLowerCase())) {
      showModal('validation', 'This task already exists. Please enter a unique task.');
      return;
    }
    
    setIsAddingTask(true);
    
    const newTodo = {
      id: Date.now(),
      task: newTask,
      completed: false,
      dueDate: dueDate,
      priority: priority,
      notified: false,
      createdAt: new Date().toISOString()
    };
    
    const updatedTodos = [...todos, newTodo];
    setTodos(updatedTodos);
    saveTodosToLocalStorage(updatedTodos);
    
    setNewTaskId(newTodo.id);
    setTimeout(() => setNewTaskId(null), 1000);
    
    setNewTask('');
    setPriority('medium');
    const now = new Date();
    setDueDate(now.toISOString().slice(0, 16));
    
    try {
      const response = await fetch(`${API_URL}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTodo),
      });
      
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const savedTodo = await response.json();
      const finalTodos = updatedTodos.map(todo => 
        todo.id === newTodo.id ? savedTodo : todo
      );
      setTodos(finalTodos);
      saveTodosToLocalStorage(finalTodos);
      
      setIsAddingTask(false);
    } catch (error) {
      console.error('Error adding todo:', error);
      setIsAddingTask(false);
      showModal('error', `Failed to sync task with server: ${error.message}. Saved locally only.`);
    }
  };
  
  const handleEdit = (todo) => {
    setEditId(todo.id);
    setEditTask(todo.task);
    setEditDueDate(todo.dueDate || '');
    setEditPriority(todo.priority || 'medium');
    setShowAddForm(false);
    
    setTimeout(() => {
      document.getElementById('edit-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  const handleUpdate = async () => {
    if (!editTask.trim()) {
      showModal('validation', 'Please enter a valid task.');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/todos/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task: editTask,
          dueDate: editDueDate,
          priority: editPriority,
          completed: todos.find(todo => todo.id === editId)?.completed || false
        }),
      });
      
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const updatedTodo = await response.json();
      const updatedTodos = todos.map(todo => 
        todo.id === editId ? updatedTodo : todo
      );
      
      setTodos(updatedTodos);
      saveTodosToLocalStorage(updatedTodos);
      
      setEditTask('');
      setEditId(null);
      setEditDueDate('');
      setEditPriority('medium');
      setShowAddForm(true);
    } catch (error) {
      console.error('Error updating todo:', error);
      
      const updatedTodos = todos.map(todo => 
        todo.id === editId 
          ? { ...todo, task: editTask, dueDate: editDueDate, priority: editPriority } 
          : todo
      );
      setTodos(updatedTodos);
      saveTodosToLocalStorage(updatedTodos);
      
      setEditTask('');
      setEditId(null);
      setEditDueDate('');
      setEditPriority('medium');
      setShowAddForm(true);
      
      showModal('error', `Failed to update task on server: ${error.message}. Updated locally only.`);
    }
  };
  
  const handleDelete = (id) => {
    if (!id) {
      showModal('error', 'Cannot delete task: Invalid task ID (undefined)');
      return;
    }
    
    let actualId = id;
    if (typeof id === 'object' && id !== null) {
      actualId = id.id;
    }
    
    if (!actualId) {
      showModal('error', 'Cannot delete task: Invalid task ID format');
      return;
    }
    
    todoToDeleteRef.current = actualId;
    showModal('delete');
  };
  
  const confirmDelete = async () => {
    try {
      let id = todoToDeleteRef.current;
      
      if (!id) {
        showModal('error', 'Cannot delete task: No task ID provided');
        closeModal();
        return;
      }
      
      if (typeof id === 'object' && id !== null) {
        id = id.id;
      }
      
      const deleteId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      if (isNaN(deleteId)) {
        showModal('error', 'Cannot delete task: Invalid task ID format');
        closeModal();
        return;
      }
      
      setDeletedTaskId(deleteId);
      closeModal();
      
      setTimeout(async () => {
        try {
          const response = await fetch(`${API_URL}/todos/${deleteId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const updatedTodos = todos.filter(todo => todo.id !== deleteId);
            setTodos(updatedTodos);
            saveTodosToLocalStorage(updatedTodos);
            setDeletedTaskId(null);
          } else if (response.status === 404) {
            await fetchTodos();
            setDeletedTaskId(null);
            showModal('info', 'This task may have been already deleted. The task list has been refreshed.');
          } else {
            let errorMessage = `Server error (${response.status})`;
            try {
              const errorText = await response.text();
              try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.message) errorMessage += `: ${errorJson.message}`;
                else if (errorJson.error) errorMessage += `: ${errorJson.error}`;
              } catch (e) {
                if (errorText.length < 100) errorMessage += `: ${errorText}`;
              }
            } catch (e) {
              console.error('Error reading error response:', e);
            }
            throw new Error(errorMessage);
          }
        } catch (error) {
          console.error('Error deleting todo:', error);
          const id = todoToDeleteRef.current;
          const updatedTodos = todos.filter(todo => todo.id !== id);
          setTodos(updatedTodos);
          saveTodosToLocalStorage(updatedTodos);
          setDeletedTaskId(null);
          
          let userMessage = 'Failed to delete task on server.';
          if (error.message.includes('500')) userMessage += ' The server encountered an internal error.';
          else if (error.message.includes('404')) userMessage += ' The task was not found on the server.';
          else userMessage += ` ${error.message}`;
          
          showModal('error', `${userMessage} Deleted locally only.`);
        }
      }, 300);
    } catch (error) {
      console.error('Error in confirmDelete:', error);
      closeModal();
      setDeletedTaskId(null);
      showModal('error', 'An unexpected error occurred while deleting the task.');
    }
  };
  
  const toggleTaskCompletion = (id) => {
    setCompletedTaskId(id);
    setTimeout(() => setCompletedTaskId(null), 1000);
    
    const updatedTodos = todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    saveTodosToLocalStorage(updatedTodos);
  };
  
  const cancelEdit = () => {
    setEditId(null);
    setEditTask('');
    setEditDueDate('');
    setEditPriority('medium');
    setShowAddForm(true);
  };
  
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  const applyAdvancedFilters = (todos) => {
    let filtered = todos;
    
    if (filter === 'active') {
      filtered = filtered.filter(todo => !todo.completed);
    } else if (filter === 'completed') {
      filtered = filtered.filter(todo => todo.completed);
    }
    
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(todo => todo.priority === priorityFilter);
    }
    
    if (dateFilter !== 'all') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      if (dateFilter === 'today') {
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= now && dueDate < tomorrow;
        });
      } else if (dateFilter === 'tomorrow') {
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= tomorrow && dueDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
        });
      } else if (dateFilter === 'thisWeek') {
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= now && dueDate < nextWeek;
        });
      } else if (dateFilter === 'overdue') {
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate < now && !todo.completed;
        });
      }
    }
    
    if (searchTerm) {
      filtered = filtered.filter(todo => 
        todo.task.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };
  
  useEffect(() => {
    const filters = [];
    
    if (filter !== 'all') {
      filters.push({ type: 'status', value: filter, label: filter === 'active' ? 'Active' : 'Completed' });
    }
    
    if (priorityFilter !== 'all') {
      filters.push({ type: 'priority', value: priorityFilter, label: getPriorityLabel(priorityFilter) });
    }
    
    if (dateFilter !== 'all') {
      let label = dateFilter;
      if (dateFilter === 'today') label = 'Today';
      else if (dateFilter === 'tomorrow') label = 'Tomorrow';
      else if (dateFilter === 'thisWeek') label = 'This Week';
      else if (dateFilter === 'overdue') label = 'Overdue';
      
      filters.push({ type: 'date', value: dateFilter, label });
    }
    
    if (searchTerm) {
      filters.push({ type: 'search', value: searchTerm, label: `Search: "${searchTerm}"` });
    }
    
    setActiveFilters(filters);
  }, [filter, priorityFilter, dateFilter, searchTerm]);
  
  const clearAllFilters = () => {
    setFilter('all');
    setPriorityFilter('all');
    setDateFilter('all');
    setSearchTerm('');
  };
  
  const removeFilter = (filterType) => {
    if (filterType === 'status') setFilter('all');
    else if (filterType === 'priority') setPriorityFilter('all');
    else if (filterType === 'date') setDateFilter('all');
    else if (filterType === 'search') setSearchTerm('');
  };
  
  const filteredTodos = applyAdvancedFilters(todos);
  
  const sortedTodos = [...filteredTodos].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    if (priorityOrder[a.priority] > priorityOrder[b.priority]) return -1;
    if (priorityOrder[a.priority] < priorityOrder[b.priority]) return 1;
    
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    
    return 0;
  });
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };
  
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return 'Medium';
    }
  };
  
  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };
  
  const applyTemplate = (template) => {
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + template.dueDateOffset);
    const formattedDate = dueDate.toISOString().slice(0, 16);
    
    setNewTask(template.task);
    setPriority(template.priority);
    setDueDate(formattedDate);
    setShowTemplates(false);
    
    setTimeout(() => {
      newTaskInputRef.current?.focus();
    }, 100);
  };
  
  const calculateProgress = () => {
    if (todos.length === 0) return 0;
    const completedCount = todos.filter(todo => todo.completed).length;
    return Math.round((completedCount / todos.length) * 100);
  };
  
  const progressPercentage = calculateProgress();
  
  const groupTasksByDate = (tasks) => {
    const groups = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDate: []
    };
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    tasks.forEach(task => {
      if (!task.dueDate) {
        groups.noDate.push(task);
        return;
      }
      
      const dueDate = new Date(task.dueDate);
      
      if (dueDate < now && !task.completed) {
        groups.overdue.push(task);
      } else if (dueDate >= now && dueDate < tomorrow) {
        groups.today.push(task);
      } else if (dueDate >= tomorrow && dueDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
        groups.tomorrow.push(task);
      } else if (dueDate >= tomorrow && dueDate < nextWeek) {
        groups.thisWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });
    
    return groups;
  };
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  const taskGroups = groupTasksByDate(sortedTodos);
  
  const showModal = (type, message = '') => {
    if (type === 'validation') {
      setModalContent({
        type: 'validation',
        title: 'Validation Error',
        message,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        actions: [
          { label: 'OK', onClick: closeModal, primary: true }
        ]
      });
    } else if (type === 'delete') {
      setModalContent({
        type: 'delete',
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this task? This action cannot be undone.',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        actions: [
          { label: 'Delete', onClick: confirmDelete, primary: true, danger: true },
          { label: 'Cancel', onClick: closeModal }
        ]
      });
    } else if (type === 'success') {
      setModalContent({
        type: 'success',
        title: 'Success',
        message,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        actions: [
          { label: 'Great!', onClick: closeModal, primary: true }
        ]
      });
    } else if (type === 'error') {
      setModalContent({
        type: 'error',
        title: 'Error',
        message,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        actions: [
          { label: 'OK', onClick: closeModal, primary: true }
        ]
      });
    } else if (type === 'info') {
      setModalContent({
        type: 'info',
        title: 'Information',
        message,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        actions: [
          { label: 'OK', onClick: closeModal, primary: true }
        ]
      });
    }
    setIsModalOpen(true);
    setModalAnimation('animate-fade-in');
  };
  
  const closeModal = () => {
    setModalAnimation('animate-fade-out');
    setTimeout(() => {
      setIsModalOpen(false);
      setModalContent(null);
      todoToDeleteRef.current = null;
      setModalAnimation('');
    }, 300);
  };
  
  // Component functions
  const renderTaskItem = (todo) => {
    const isNew = newTaskId === todo.id;
    const isDeleted = deletedTaskId === todo.id;
    const isCompleted = completedTaskId === todo.id;
    
    let animationClass = '';
    if (isNew) animationClass = 'animate-slide-in';
    if (isDeleted) animationClass = 'animate-fade-out';
    if (isCompleted) animationClass = 'animate-check';
    
    return (
      <li 
        key={todo.id} 
        className={`task-item flex flex-col p-4 rounded-xl shadow-sm transition-all duration-300 ${
          editId === todo.id 
            ? (darkMode 
              ? 'bg-gray-700 border-l-4 border-indigo-500 transform scale-[1.02]' 
              : 'bg-indigo-50 border-l-4 border-indigo-500 transform scale-[1.02]')
            : (darkMode 
              ? 'bg-gray-700 hover:bg-gray-600' 
              : 'bg-white border border-gray-200 hover:bg-gray-50 hover:shadow-md')
        } ${animationClass}`}
        style={isDeleted ? { height: 0, padding: 0, margin: 0, opacity: 0 } : {}}
      >
        <div className="flex justify-between items-start">
          <div className="flex items-start">
            <button
              onClick={() => toggleTaskCompletion(todo.id)}
              className={`mr-3 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 mt-1 ${
                todo.completed 
                  ? (darkMode ? 'bg-green-500 border-green-500' : 'bg-green-500 border-green-500')
                  : (darkMode ? 'border-gray-400 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400')
              }`}
              aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
            >
              {todo.completed && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <span className={`font-medium transition-colors duration-300 break-words ${
                todo.completed 
                  ? (darkMode ? 'text-gray-400 line-through' : 'text-gray-400 line-through')
                  : (darkMode ? 'text-white' : 'text-gray-800')
              }`}>
                {searchTerm && todo.task.toLowerCase().includes(searchTerm.toLowerCase()) ? (
                  <>
                    {todo.task.split(new RegExp(`(${searchTerm})`, 'gi')).map((part, index) => 
                      part.toLowerCase() === searchTerm.toLowerCase() ? (
                        <mark key={index} className="bg-yellow-300 text-gray-900 dark:bg-yellow-500 dark:text-gray-900">
                          {part}
                        </mark>
                      ) : (
                        part
                      )
                    )}
                  </>
                ) : (
                  capitalizeFirstWord(todo.task)
                )}
              </span>
              
              <div className="flex flex-wrap items-center mt-2 gap-2">
                {todo.dueDate && (
                  <div className={`flex items-center text-xs ${
                    isOverdue(todo.dueDate) && !todo.completed
                      ? 'text-red-500 font-medium'
                      : (darkMode ? 'text-gray-400' : 'text-gray-500')
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate max-w-[120px] sm:max-w-xs">{formatDate(todo.dueDate)}</span>
                    {isOverdue(todo.dueDate) && !todo.completed && (
                      <span className="ml-1">• Overdue</span>
                    )}
                  </div>
                )}
                
                <div className="flex items-center">
                  <span className={`inline-block w-3 h-3 rounded-full mr-1 ${getPriorityColor(todo.priority)}`}></span>
                  <span className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {getPriorityLabel(todo.priority)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2 flex-shrink-0">
            <button
              onClick={() => handleEdit(todo)}
              className={`p-3 rounded-lg transition-all duration-300 transform hover:scale-110 ${
                darkMode 
                  ? 'bg-yellow-900 text-yellow-300 hover:bg-yellow-800' 
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
              aria-label="Edit task"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              onClick={() => handleDelete(todo.id)}
              className={`p-3 rounded-lg transition-all duration-300 transform hover:scale-110 ${
                darkMode 
                  ? 'bg-red-900 text-red-300 hover:bg-red-800' 
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
              aria-label="Delete task"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </li>
    );
  };
  
  // Components
  const Header = () => (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-1 transition-colors duration-300">
          {darkMode ? 'Todo App' : 'Todo App'}
        </h1>
        <p className={`text-xs md:text-sm transition-colors duration-300 ${
          darkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Stay organized and productive
        </p>
      </div>
      <button
        onClick={toggleDarkMode}
        className={`p-3 md:p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
          darkMode 
            ? 'bg-yellow-400 text-gray-900' 
            : 'bg-indigo-600 text-white'
        }`}
        aria-label="Toggle dark mode"
      >
        {darkMode ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </button>
    </div>
  );
  
  const ServerStatus = () => (
    <div className="flex items-center justify-center mb-4">
      <div className={`h-3 w-3 rounded-full mr-2 ${
        serverStatus === 'online' ? 'bg-green-500' : 
        serverStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
      }`}></div>
      <span className={`text-xs ${
        darkMode ? 'text-gray-400' : 'text-gray-500'
      }`}>
        {serverStatus === 'online' ? 'Server Online' : 
         serverStatus === 'offline' ? 'Server Offline' : 'Checking Server...'}
      </span>
    </div>
  );
  
  const ProgressBar = () => {
    const progressPercentage = calculateProgress();
    
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Progress
          </span>
          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {progressPercentage}%
          </span>
        </div>
        <div className={`w-full h-3 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div 
            className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-1">
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {todos.filter(todo => !todo.completed).length} active
          </span>
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {todos.length} total
          </span>
        </div>
      </div>
    );
  };
  
  const SearchAndFilters = () => {
    return (
      <div className="mb-6 space-y-3">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            ref={searchInputRef}
            className={`w-full p-4 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-indigo-500 focus:border-transparent' 
                : 'border border-gray-300 text-gray-900 focus:ring-indigo-500 focus:border-transparent'
            }`}
            placeholder="Search tasks..."
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {activeFilters.map((filter, index) => (
              <div 
                key={index} 
                className={`flex items-center px-3 py-2 rounded-full text-sm ${
                  darkMode ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                <span>{filter.label}</span>
                <button 
                  onClick={() => removeFilter(filter.type)}
                  className="ml-2 text-current hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
            <button 
              onClick={clearAllFilters}
              className={`text-sm px-3 py-2 rounded-full ${
                darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Clear all
            </button>
          </div>
        )}
        
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-4 rounded-lg font-medium transition-all duration-300 ${
              filter === 'all' 
                ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white')
                : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`flex-1 py-4 rounded-lg font-medium transition-all duration-300 ${
              filter === 'active' 
                ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white')
                : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`flex-1 py-4 rounded-lg font-medium transition-all duration-300 ${
              filter === 'completed' 
                ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white')
                : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
            }`}
          >
            Completed
          </button>
        </div>
        
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`w-full py-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center ${
            darkMode 
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mr-1 transition-transform duration-300 ${showAdvancedFilters ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Advanced Filters
        </button>
        
        {showAdvancedFilters && (
          <div className="space-y-3 p-4 rounded-lg border border-gray-300 dark:border-gray-600 transition-all duration-300">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Priority
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['high', 'medium', 'low'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriorityFilter(priorityFilter === p ? 'all' : p)}
                    className={`py-3 rounded-lg font-medium transition-all duration-300 ${
                      priorityFilter === p 
                        ? (darkMode ? `bg-${p === 'high' ? 'red' : p === 'medium' ? 'yellow' : 'green'}-600 text-white` : `bg-${p === 'high' ? 'red' : p === 'medium' ? 'yellow' : 'green'}-600 text-white`)
                        : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Due Date
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['today', 'tomorrow', 'thisWeek', 'overdue'].map((d) => {
                  const label = d === 'today' ? 'Today' : 
                               d === 'tomorrow' ? 'Tomorrow' : 
                               d === 'thisWeek' ? 'This Week' : 'Overdue';
                  return (
                    <button
                      key={d}
                      onClick={() => setDateFilter(dateFilter === d ? 'all' : d)}
                      className={`py-3 rounded-lg font-medium transition-all duration-300 ${
                        dateFilter === d 
                          ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white')
                          : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const TaskTemplatesButton = () => (
    <div className="mb-6">
      <button
        onClick={() => setShowTemplates(true)}
        className={`w-full py-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center ${
          darkMode 
            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
        </svg>
        Use Task Template
      </button>
    </div>
  );
  
  const AddTaskForm = () => (
    showAddForm && (
      <div className="mb-6 p-4 rounded-xl transition-all duration-300">
        <h3 className={`font-medium mb-3 ${
          darkMode ? 'text-indigo-300' : 'text-indigo-800'
        }`}>
          Add New Task
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            ref={newTaskInputRef}
            className={`w-full p-4 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-indigo-500 focus:border-transparent' 
                : 'border border-gray-300 text-gray-900 focus:ring-indigo-500 focus:border-transparent'
            }`}
            placeholder="What needs to be done?"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Due Date
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full p-3 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-indigo-500 focus:border-transparent' 
                    : 'border border-gray-300 text-gray-900 focus:ring-indigo-500 focus:border-transparent'
                }`}
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Priority
              </label>
              <div className="flex space-x-4">
                {['high', 'medium', 'low'].map((p) => (
                  <label key={p} className="flex items-center">
                    <input
                      type="radio"
                      name="priority"
                      value={p}
                      checked={priority === p}
                      onChange={() => setPriority(p)}
                      className="sr-only"
                    />
                    <div 
                      onClick={() => setPriority(p)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors duration-200 ${
                        priority === p 
                          ? (p === 'high' ? 'border-red-500 bg-red-500' : 
                             p === 'medium' ? 'border-yellow-500 bg-yellow-500' : 
                             'border-green-500 bg-green-500')
                          : (darkMode ? 'border-gray-400' : 'border-gray-300')
                      }`}
                    >
                      {priority === p && (
                        <div className="w-4 h-4 rounded-full bg-white"></div>
                      )}
                    </div>
                    <span className="ml-1 text-sm capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleAdd}
            disabled={isAddingTask}
            className={`w-full p-4 rounded-lg transition-all duration-300 flex items-center justify-center transform hover:scale-105 ${
              isAddingTask 
                ? 'bg-indigo-400 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isAddingTask ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Task
              </>
            )}
          </button>
        </div>
      </div>
    )
  );
  
  const EditTaskForm = () => (
    editId && (
      <div 
        id="edit-section"
        className={`mb-6 p-4 rounded-xl border-l-4 transition-all duration-500 ${
          darkMode 
            ? 'bg-gray-700 border-indigo-500' 
            : 'bg-indigo-50 border-indigo-500'
        } ${
          editId ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <h3 className={`font-medium mb-3 flex items-center ${
          darkMode ? 'text-indigo-300' : 'text-indigo-800'
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
          Editing Task
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            value={editTask}
            onChange={(e) => setEditTask(e.target.value)}
            className={`w-full p-4 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-indigo-500 focus:border-transparent' 
                : 'border border-indigo-300 text-gray-900 focus:ring-indigo-500 focus:border-transparent bg-white'
            }`}
            placeholder="Edit your task"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Due Date
              </label>
              <input
                type="datetime-local"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className={`w-full p-3 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-indigo-500 focus:border-transparent' 
                    : 'border border-indigo-300 text-gray-900 focus:ring-indigo-500 focus:border-transparent bg-white'
                }`}
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Priority
              </label>
              <div className="flex space-x-4">
                {['high', 'medium', 'low'].map((p) => (
                  <label key={p} className="flex items-center">
                    <input
                      type="radio"
                      name="editPriority"
                      value={p}
                      checked={editPriority === p}
                      onChange={() => setEditPriority(p)}
                      className="sr-only"
                    />
                    <div 
                      onClick={() => setEditPriority(p)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors duration-200 ${
                        editPriority === p 
                          ? (p === 'high' ? 'border-red-500 bg-red-500' : 
                             p === 'medium' ? 'border-yellow-500 bg-yellow-500' : 
                             'border-green-500 bg-green-500')
                          : (darkMode ? 'border-gray-400' : 'border-gray-300')
                      }`}
                    >
                      {editPriority === p && (
                        <div className="w-4 h-4 rounded-full bg-white"></div>
                      )}
                    </div>
                    <span className="ml-1 text-sm capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleUpdate}
              className="flex-1 bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 transition-all duration-300 font-medium transform hover:scale-[1.02]"
            >
              Save Changes
            </button>
            <button
              onClick={cancelEdit}
              className="flex-1 bg-gray-500 text-white py-4 rounded-lg hover:bg-gray-600 transition-all duration-300 font-medium transform hover:scale-[1.02]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  );
  
  const TaskList = () => {
    const taskGroups = groupTasksByDate(sortedTodos);
    
    return (
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 transition-all duration-300">
        {sortedTodos.length === 0 ? (
          <div className="text-center py-8 transition-all duration-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
              {searchTerm || filter !== 'all' || priorityFilter !== 'all' || dateFilter !== 'all' 
                ? 'No tasks match your search or filter.' 
                : 'No tasks yet. Add a task to get started!'}
            </p>
            {serverStatus === 'offline' && (
              <p className="text-red-500 mt-2 text-sm">Server is offline. Please start the server to sync tasks.</p>
            )}
          </div>
        ) : (
          <>
            {Object.entries(taskGroups).map(([sectionName, tasks]) => {
              if (tasks.length === 0) return null;
              
              const sectionTitle = sectionName === 'overdue' ? 'Overdue' :
                                 sectionName === 'today' ? 'Today' :
                                 sectionName === 'tomorrow' ? 'Tomorrow' :
                                 sectionName === 'thisWeek' ? 'This Week' :
                                 sectionName === 'later' ? 'Later' : 'No Date';
              
              const isOverdueSection = sectionName === 'overdue';
              const sectionColor = isOverdueSection ? 'text-red-500' : 'text-gray-700 dark:text-gray-300';
              
              return (
                <div key={sectionName} className="mb-4">
                  <button 
                    onClick={() => toggleSection(sectionName)}
                    className="flex items-center w-full p-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mr-2 transition-transform duration-300 ${expandedSections[sectionName] ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className={`font-medium ${sectionColor}`}>{sectionTitle} ({tasks.length})</span>
                  </button>
                  
                  {expandedSections[sectionName] && (
                    <div className="mt-2 space-y-3 pl-7">
                      {tasks.map(todo => renderTaskItem(todo))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };
  
  const Modal = () => {
    if (!isModalOpen || !modalContent) return null;
    return createPortal(
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className={`absolute inset-0 bg-black backdrop-blur-sm transition-opacity duration-400 ${
            isModalOpen ? 'bg-opacity-60' : 'bg-opacity-0'
          }`}
          onClick={closeModal}
        ></div>
        
        <div className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 transform transition-all duration-400 ${modalAnimation}`}>
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              {modalContent.icon}
            </div>
            <h3 className="text-xl md:text-2xl font-bold mb-3 text-gray-800 dark:text-white">{modalContent.title}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-8 text-base md:text-lg">{modalContent.message}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              {modalContent.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`px-6 py-4 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                    action.primary 
                      ? action.danger 
                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-md' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };
  
  const TemplatesModal = () => {
    if (!showTemplates) return null;
    
    return createPortal(
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="absolute inset-0 bg-black backdrop-blur-sm transition-opacity duration-400 bg-opacity-60"
          onClick={() => setShowTemplates(false)}
        ></div>
        
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 transform transition-all duration-400">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Task Templates</h3>
            <button 
              onClick={() => setShowTemplates(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-3">
            {taskTemplates.map((template, index) => (
              <div 
                key={index}
                className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-200"
                onClick={() => applyTemplate(template)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-800 dark:text-white">{template.task}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    template.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    template.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {getPriorityLabel(template.priority)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Due in {template.dueDateOffset} day{template.dueDateOffset !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );
  };
  
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white' 
        : 'bg-gradient-to-br from-indigo-50 to-purple-100 text-gray-900'
    } flex items-center justify-center py-6 px-4 md:py-10`}>
      <div className={`w-full max-w-md transition-all duration-300 ${
        darkMode 
          ? 'bg-gray-800 shadow-2xl rounded-2xl p-4 md:p-6' 
          : 'bg-white shadow-2xl rounded-2xl p-4 md:p-6'
      }`}>
        <Header />
        <ServerStatus />
        <ProgressBar />
        <SearchAndFilters />
        <TaskTemplatesButton />
        <AddTaskForm />
        <EditTaskForm />
        <TaskList />
      </div>
      
      <Modal />
      <TemplatesModal />
      
      <style jsx>{`
        @keyframes fade-in {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fade-out {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(20px);
          }
        }
        
        @keyframes slide-in {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
          }
        }
        
        @keyframes check {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        
        .animate-fade-out {
          animation: fade-out 0.3s ease-in forwards;
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
        
        .animate-pulse {
          animation: pulse 0.5s ease-in-out;
        }
        
        .animate-check {
          animation: check 0.3s ease-in-out;
        }
        
        .task-item {
          transition: all 0.3s ease;
        }
        
        .task-item:hover {
          transform: translateY(-2px);
        }
        
        .dark ::-webkit-scrollbar {
          width: 8px;
        }
        
        .dark ::-webkit-scrollbar-track {
          background: #374151;
        }
        
        .dark ::-webkit-scrollbar-thumb {
          background: #4B5563;
          border-radius: 4px;
        }
        
        .dark ::-webkit-scrollbar-thumb:hover {
          background: #6B7280;
        }
        
        /* Mobile-specific styles */
        @media (max-width: 640px) {
          button {
            min-height: 48px; /* Minimum touch target size */
            padding: 16px;
          }
          
          .space-y-3 > * + * {
            margin-top: 0.75rem;
          }
          
          .truncate {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          /* Make radio buttons larger on mobile */
          input[type="radio"] {
            width: 24px;
            height: 24px;
          }
          
          /* Ensure proper spacing in modals */
          .modal-content {
            padding: 1rem;
          }
          
          /* Make task items easier to tap */
          .task-item {
            padding: 1.25rem;
          }
          
          /* Make edit and delete buttons larger */
          .task-item button {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          /* Make icons larger */
          svg {
            width: 24px;
            height: 24px;
          }
          
          /* Make form inputs larger */
          input {
            padding: 16px;
            font-size: 16px; /* Prevents zoom on iOS */
          }
          
          /* Make filter buttons larger */
          .filter-buttons button {
            padding: 16px;
          }
          
          /* Make section headers larger */
          .section-header {
            padding: 16px;
          }
          
          /* Fix dark mode toggle icon */
          .dark-mode-toggle svg {
            width: 24px;
            height: 24px;
          }
        }
        
        @media (max-width: 480px) {
          .p-4 {
            padding: 1rem;
          }
          
          h1 {
            font-size: 1.5rem;
          }
          
          .flex.space-x-3 {
            gap: 0.5rem;
          }
          
          .flex.space-x-3 button {
            flex: 1;
          }
          
          /* Make radio buttons even larger on very small screens */
          input[type="radio"] {
            width: 28px;
            height: 28px;
          }
          
          /* Make priority indicators larger */
          .priority-indicator {
            width: 14px;
            height: 14px;
          }
          
          /* Make task list items more spacious */
          .task-item {
            padding: 1.5rem;
          }
          
          /* Make buttons even larger on small screens */
          button {
            min-height: 52px;
            padding: 18px;
          }
          
          /* Make icons even larger */
          svg {
            width: 28px;
            height: 28px;
          }
          
          /* Make inputs even larger */
          input {
            padding: 18px;
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
};
export default App;