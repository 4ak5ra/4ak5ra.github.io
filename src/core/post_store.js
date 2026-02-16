// 契约：不可变数据流 + 可订阅状态
// 输入：fetchFn - 异步获取数据的函数
// 输出：具有状态管理和订阅功能的store对象

export function createPostStore(fetchFn) {
  let state = { 
    all: [], 
    filtered: [], 
    loading: false 
  };
  
  const subscribers = [];
  
  const notify = () => {
    subscribers.forEach(fn => fn(state));
  };
  
  return {
    // 获取当前状态的不可变副本
    getState: () => ({ ...state }),
    
    // 纯函数更新：应用过滤器
    applyFilter: (filterFn) => {
      state.filtered = filterFn(state.all);
      notify();
    },
    
    // 副作用隔离：刷新数据
    refresh: async () => {
      state.loading = true;
      notify();
      
      try {
        state.all = await fetchFn();
        state.filtered = state.all; // 默认不过滤
        state.loading = false;
        notify();
      } catch (error) {
        state.loading = false;
        notify();
        throw error;
      }
    },
    
    // 订阅状态变化
    subscribe: (fn) => {
      subscribers.push(fn);
      return () => {
        const index = subscribers.indexOf(fn);
        if (index !== -1) subscribers.splice(index, 1);
      };
    }
  };
}

// 纯函数过滤器工厂
// 契约：接受参数返回过滤器函数，过滤器函数接受posts数组返回过滤后的数组

export function createTextFilter(query) {
  const q = query.trim().toLowerCase();
  return posts => 
    q ? posts.filter(p => 
      String(p.title || '').toLowerCase().includes(q) ||
      String(p.content || '').toLowerCase().includes(q)
    ) : posts;
}

export function createCategoryFilter(category) {
  return posts => 
    category ? posts.filter(p => p.category === category) : posts;
}

// 排序函数（纯函数）
export function sortByDateDesc(posts) {
  return posts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
}