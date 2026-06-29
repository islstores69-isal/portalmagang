const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxVw0rmhZniM14jY0kf6wis0TrX1dbva2BPa45al7p-Bl_h88Pjf7rjinYeFMZoLIhd/exec';

// Mock storage for local testing if localStorage is not available or desired
const storage = {
    get: (key, defaultValue = null) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.error('localStorage.get error:', e);
            return defaultValue;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('localStorage.set error:', e);
        }
    }
};

// Mock dateTime for local testing if not available
const dateTime = {
    getLocalDate: () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};

const api = {
    async request(action, data = {}) {
        if (!API_BASE_URL) {
            return this._localFallback(action, data);
        }

        try {
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action, ...data })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            try {
                const result = JSON.parse(text);
                // Handle potential GAS error messages that might not be JSON valid
                if (typeof result === 'string' && result.includes('Error')) {
                     console.error('GAS Error Response:', result);
                     return { success: false, error: result };
                }
                return result;
            } catch (e) {
                console.error('Failed to parse response:', text.substring(0, 200));
                return { success: false, error: 'Invalid response from server' };
            }
        } catch (error) {
            console.error('API Request Error:', error);
            // Fallback to localStorage on network error or invalid response
            return this._localFallback(action, data);
        }
    },

    // ========== AUTH ==========
    async login(email, password) {
        if (!API_BASE_URL) {
            return this._localLogin(email, password);
        }
        return this.request('login', { email, password });
    },

    async changePassword(userId, oldPassword, newPassword) {
        if (!API_BASE_URL) {
            return { success: true, data: { message: 'Password changed (local)' } };
        }
        return this.request('changePassword', { userId, oldPassword, newPassword });
    },

    async getEmployeeProfile(userId) {
        if (!API_BASE_URL) {
            // Mock profile for local testing
            return { success: true, data: {
                id: userId,
                name: 'John Doe',
                email: 'john.doe@example.com',
                role: 'Employee',
                avatar: `https://ui-avatars.com/api/?name=John%20Doe&background=F59E0B&color=fff`
            }};
        }
        return this.request('getEmployeeProfile', { userId });
    },

    // ========== ATTENDANCE ==========
    async getAttendance(userId) {
        if (!API_BASE_URL) {
            const all = storage.get('attendance', []);
            return { success: true, data: all.filter(a => a.userId === userId) };
        }
        return this.request('getAttendance', { userId });
    },

    async getTodayAttendance(userId) {
        if (!API_BASE_URL) {
            const today = dateTime.getLocalDate();
            const all = storage.get('attendance', []);
            const todayRecord = all.find(a => a.date === today && a.userId === userId);
            return {
                success: true,
                data: todayRecord || {
                    userId: userId,
                    date: today,
                    shift: 'Pagi', // Default shift
                    clockIn: null,
                    clockOut: null,
                    breakStart: null,
                    breakEnd: null,
                    overtimeStart: null,
                    status: 'waiting'
                }
            };
        }
        return this.request('getTodayAttendance', { userId });
    },

    async saveAttendance(data) {
        if (!API_BASE_URL) {
            const all = storage.get('attendance', []);
            const idx = all.findIndex(a => a.date === data.date && a.userId === data.userId);
            if (idx >= 0) { all[idx] = { ...all[idx], ...data }; } else { all.unshift(data); }
            storage.set('attendance', all);
            return { success: true, data: data };
        }
        return this.request('saveAttendance', data);
    },

    async getAllAttendance() {
        if (!API_BASE_URL) {
            return { success: true, data: storage.get('attendance', []) };
        }
        return this.request('getAllAttendance');
    },

    // ========== JOURNALS ==========
    async getJournals(userId) {
        if (!API_BASE_URL) {
            return { success: true, data: storage.get('jurnals', []).filter(j => j.userId === userId) };
        }
        return this.request('getJournals', { userId });
    },

    async saveJournal(data) {
        if (!API_BASE_URL) {
            const all = storage.get('jurnals', []);
            const idx = all.findIndex(j => j.date === data.date && j.userId === data.userId);
            if (idx >= 0) { all[idx] = { ...all[idx], ...data }; } else { all.unshift(data); }
            storage.set('jurnals', all);
            return { success: true, data: data };
        }
        return this.request('saveJournal', data);
    },

    async getAllJournals() {
        if (!API_BASE_URL) {
            return { success: true, data: storage.get('jurnals', []) };
        }
        return this.request('getAllJournals');
    },

    // ========== LEAVES (CUTI) ==========
    async getLeaves(userId) {
        if (!API_BASE_URL) {
            return { success: true, data: storage.get('leaves', []).filter(l => l.userId === userId) };
        }
        return this.request('getLeaves', { userId });
    },

    async submitLeave(data) {
        if (!API_BASE_URL) {
            const all = storage.get('leaves', []);
            const newLeave = {
                id: Date.now() + Math.random(), // Unique ID
                ...data,
                status: 'pending',
                appliedAt: new Date().toISOString()
            };
            all.unshift(newLeave);
            storage.set('leaves', all);
            return { success: true, data: newLeave };
        }
        return this.request('submitLeave', data);
    },

    async approveLeave(id) {
        if (!API_BASE_URL) {
            const all = storage.get('leaves', []);
            const leave = all.find(l => l.id === id);
            if (leave) {
                leave.status = 'approved';
                storage.set('leaves', all);
            }
            return { success: true, data: leave };
        }
        return this.request('approveLeave', { id });
    },

    async rejectLeave(id) {
        if (!API_BASE_URL) {
            const all = storage.get('leaves', []);
            const leave = all.find(l => l.id === id);
            if (leave) {
                leave.status = 'rejected';
                storage.set('leaves', all);
            }
            return { success: true, data: leave };
        }
        return this.request('rejectLeave', { id });
    },

    async getAllLeaves() {
        if (!API_BASE_URL) {
            return { success: true, data: storage.get('leaves', []) };
        }
        return this.request('getAllLeaves');
    },

    // ========== IZIN / PERMISSION ==========
    async getIzin(userId) {
        if (!API_BASE_URL) {
            return { success: true, data: storage.get('izin', []).filter(i => i.userId === userId) };
        }
        return this.request('getIzin', { userId });
    },

    async submitIzin(data) {
        if (!API_BASE_URL) {
            const all = storage.get('izin', []);
            const newIzin = {
                id: Date.now() + Math.random(), // Unique ID
                ...data,
                status: 'pending',
                appliedAt: new Date().toISOString()
            };
            all.unshift(newIzin);
            storage.set('izin', all);
            return { success: true, data: newIzin };
        }
        return this.request('submitIzin', data);
    },

    async approveIzin(id) {
        if (!API_BASE_URL) {
            const all = storage.get('izin', []);
            const item = all.find(i => i.id === id);
            if (item) {
                item.status = 'approved';
                storage.set('izin', all);
            }
            return { success: true, data: item };
        }
        return this.request('approveIzin', { id });
    },

    async rejectIzin(id) {
        if (!API_BASE_URL) {
            const all = storage.get('izin', []);
            const item = all.find(i => i.id === id);
            if (item) {
                item.status = 'rejected';
                storage.set('izin', all);
            }
            return { success: true, data: item };
        }
        return this.request('rejectIzin', { id });
    },

    async getAllIzin() {
        if (!API_BASE_URL) {
            return { success: true, data: storage.get('izin', []) };
        }
        return this.request('getAllIzin');
    },

    // ========== EMPLOYEES ==========
    async getEmployees() {
        if (!API_BASE_URL) {
            return { success: true, data: storage.get('admin_employees', []) };
        }
        return this.request('getEmployees');
    },

    async addEmployee(data) {
        if (!API_BASE_URL) {
            const all = storage.get('admin_employees', []);
            if (all.some(e => e.email === data.email)) {
                return { success: false, error: 'Email sudah terdaftar' };
            }
            const newEmployee = {
                id: Date.now(), // Using timestamp as ID for simplicity
                ...data,
                avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=F59E0B&color=fff`,
                role: data.role || 'Employee' // Default role
            };
            all.unshift(newEmployee);
            storage.set('admin_employees', all);
            return { success: true, data: newEmployee };
        }
        return this.request('addEmployee', data);
    },

    async updateEmployee(id, data) {
        if (!API_BASE_URL) {
            const all = storage.get('admin_employees', []);
            const idx = all.findIndex(e => e.id === id);
            if (idx >= 0) {
                Object.assign(all[idx], data);
                storage.set('admin_employees', all);
            }
            return { success: true, data: all[idx] };
        }
        return this.request('updateEmployee', { id, ...data });
    },

    async deleteEmployee(id) {
        if (!API_BASE_URL) {
            let all = storage.get('admin_employees', []);
            all = all.filter(e => e.id !== id);
            storage.set('admin_employees', all);
            return { success: true, data: { id } };
        }
        return this.request('deleteEmployee', { id });
    },

    // ========== SETTINGS ==========
    async getSettings() {
        if (!API_BASE_URL) {
            const company = storage.get('company', { name: 'Portal Karyawan', logo: '' });
            return {
                success: true,
                data: { company_name: company.name, company_logo: company.logo }
            };
        }
        return this.request('getSettings');
    },

    async saveSetting(key, value) {
        if (!API_BASE_URL) {
            if (key === 'company_name' || key === 'company_logo') {
                const company = storage.get('company', { name: '', logo: '' });
                if (key === 'company_name') company.name = value;
                if (key === 'company_logo') company.logo = value;
                storage.set('company', company);
            }
            return { success: true, data: { key, value } };
        }
        return this.request('saveSetting', { key, value });
    },

    // ========== SHIFTS ==========
    async getShifts() {
        if (!API_BASE_URL) {
            return { success: true, data: storage.get('shifts', []) };
        }
        return this.request('getShifts');
    },

    async addShift(data) {
        if (!API_BASE_URL) {
            const all = storage.get('shifts', []);
            const newShift = {
                id: Date.now(), // Using timestamp as ID for simplicity
                ...data
            };
            all.push(newShift);
            storage.set('shifts', all);
            return { success: true, data: newShift };
        }
        return this.request('addShift', data);
    },

    async updateShift(id, data) {
        if (!API_BASE_URL) {
            const all = storage.get('shifts', []);
            // Attempt to find by number or string ID
            const idx = all.findIndex(s => s.id === id || s.id === Number(id));
            if (idx >= 0) {
                Object.assign(all[idx], data);
                storage.set('shifts', all);
            }
            return { success: true, data: all[idx] };
        }
        return this.request('updateShift', { id, ...data });
    },

    async deleteShift(id) {
        if (!API_BASE_URL) {
            let all = storage.get('shifts', []);
            all = all.filter(s => s.id !== id && s.id !== Number(id));
            storage.set('shifts', all);
            return { success: true, data: { id } };
        }
        return this.request('deleteShift', { id });
    },

    // ========== SCHEDULE ==========
    async getSchedule(month, year) {
        if (!API_BASE_URL) {
            const key = `schedule_${year}_${month}`;
            return { success: true, data: storage.get(key, {}) };
        }
        return this.request('getSchedule', { month, year });
    },

    async saveSchedule(data) {
        if (!API_BASE_URL) {
            const key = `schedule_${data.year}_${data.month}`;
            storage.set(key, data.schedule || {});
            return { success: true };
        }
        return this.request('saveSchedule', data);
    },

    // ========== LOCAL AUTH FALLBACK ==========
    _localLogin(email, password) {
        // In local mode, we simulate a successful login for any credentials.
        // The actual role/authorization logic would need to be handled by the frontend in this mode.
        console.log('Simulating local login for:', email);
        // Returning null data implies the frontend should handle user state/role based on other logic.
        return { success: true, data: null };
    },

    // Fallback for actions not explicitly handled by specific methods in local mode
    _localFallback(action, data) {
        console.warn(`API Fallback: ${action} called, using localStorage simulation.`);
        // Generic fallback if a specific local implementation is missing
        // This is a placeholder and might need more specific implementations for various actions
        const mockData = {
            login: () => ({ success: true, data: null }), // Mock login
            getEmployeeProfile: (userId) => ({ success: true, data: { id: userId, name: 'Local User', email: 'local@example.com', role: 'Employee', avatar: `https://ui-avatars.com/api/?name=Local%20User&background=0000FF&color=fff` } }),
            // Add other mock actions as needed
        };

        if (mockData[action]) {
            try {
                return mockData[action](data);
            } catch (e) {
                console.error(`Error executing mock for action ${action}:`, e);
                return { success: false, error: `Mock fallback failed for ${action}` };
            }
        }

        // If no specific mock found, return a generic error or empty success
        // In a real scenario, you'd want to replicate the expected structure
        // For now, returning an error to indicate missing local implementation
        return { success: false, error: `No local fallback implemented for action: ${action}` };
    }
};

// Expose to global scope for easy access
window.api = api;

// Helper function to get a consistent and valid avatar URL
window.getAvatarUrl = function (emp) {
    if (emp && emp.avatar && emp.avatar.startsWith('http')) {
        return emp.avatar;
    }
    // Fallback name if emp or emp.name is missing
    const name = (emp && emp.name) ? emp.name : 'User';
    const colors = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6', 'EC4899', '14B8A6', '6B7280'];
    const colorIdx = name.toLowerCase().charCodeAt(0) % colors.length; // Use lowercase char code for better distribution
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${colors[colorIdx]}&color=fff`;
};