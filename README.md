# 🎯 ReactInterviewPro - AI-Powered Mock Interview Platform

> **A comprehensive full-stack mock interview platform** designed to help candidates prepare for technical interviews at leading companies with company-specific modules, AI-powered feedback, and real-time code reviews.

![React](https://img.shields.io/badge/React-19.1.0-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-FastAPI-339933)
![Material-UI](https://img.shields.io/badge/Material--UI-7.1.1-007FFF?logo=mui)
![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?logo=python)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Supported Companies](#-supported-companies)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Endpoints](#-api-endpoints)
- [Architecture](#-architecture)
- [Key Components](#-key-components)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**ReactInterviewPro** is a modern, full-stack web application that provides mock interview experiences tailored to specific companies. Candidates can:

- ✅ Practice company-specific aptitude tests
- ✅ Solve coding challenges with real-time feedback
- ✅ Track progress with detailed analytics
- ✅ Receive AI-powered insights and recommendations
- ✅ Review past test attempts and performance metrics

The platform uses **Google Gemini AI** for intelligent code reviews and **Material-UI** for a polished, professional user experience.

---

## ✨ Features

### 🧪 Test Types

#### **Aptitude Tests**
- **Multiple difficulty levels**: Beginner, Intermediate, Advanced
- **Comprehensive question bank** covering:
  - Quantitative aptitude
  - Logical reasoning
  - Verbal ability
  - Situational judgment
  - Puzzles & problem-solving
- **Instant scoring** with detailed breakdown
- **AI-generated feedback** with personalized recommendations
- **Section-wise performance analysis**

#### **Coding Challenges**
- **Real-time code editor** with syntax highlighting
- **Multi-language support** (integrated with Judge0 API)
- **AI-powered code review** using Google Gemini
  - Code quality assessment
  - Best practices feedback
  - Edge case analysis
  - Optimization suggestions
- **Difficulty progression**: Beginner → Intermediate → Advanced
- **Company-specific problems** tailored to recruitment patterns

### 📊 Dashboard & Analytics
- **Test history** with scores and timestamps
- **Performance metrics** and progress tracking
- **Strengths & weakness identification**
- **Personalized recommendations** for improvement
- **Visual analytics** using Chart.js

### 👤 User Management
- **Persistent user profiles** with test history
- **Local authentication** system
- **Profile page** displaying statistics and past attempts
- **Session management** with auto-save

### 🎨 User Experience
- **Beautiful glass-morphism design** with modern UI
- **Smooth animations** using Framer Motion
- **Responsive layout** for all devices
- **Dark/Light theme support** via Material-UI
- **Intuitive navigation** flow

---

## 🏢 Supported Companies

ReactInterviewPro provides company-specific interview preparation modules for:

1. **Amazon** - Focus on algorithmic problem-solving and aptitude
2. **TCS (Tata Consultancy Services)** - Comprehensive aptitude coverage
3. **Infosys** - Coding and logical reasoning emphasis
4. **Wipro** - Balanced aptitude and coding challenges
5. **Accenture** - Business and technical assessment focus

Each company module includes:
- ✅ 10-15 aptitude questions per difficulty level
- ✅ 3-5 coding challenges per difficulty level
- ✅ Company-specific weightage and topics

---

## 🛠️ Tech Stack

### **Frontend**
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.1.0 | UI framework |
| Vite | 6.3.5 | Build tool & dev server |
| Material-UI (MUI) | 7.1.1 | Component library |
| React Router | 6.19.0 | Client-side routing |
| Axios | 1.6.2 | HTTP client |
| Framer Motion | 12.16.0 | Animations |
| Chart.js | 4.4.9 | Data visualization |
| React Icons | 5.5.0 | Icon library |
| Emotion | 11.14.0 | CSS-in-JS styling |

### **Backend**
| Technology | Purpose |
|-----------|---------|
| FastAPI | Modern async web framework |
| Python 3.x | Server runtime |
| Pydantic | Data validation |
| python-dotenv | Environment configuration |
| google-generativeai | Gemini AI integration |
| requests | HTTP requests |
| CORS Middleware | Cross-origin request handling |

### **External APIs**
- **Google Gemini 1.5 Flash** - AI code review and feedback
- **Judge0 CE** - Code execution & compilation (optional)

### **Data Storage**
- **JSON files** - User profiles and test history
- **Persistent storage** - Local filesystem

---

## 📁 Project Structure

```
ReactNodeInterviewMatrix---Comprehensive-Interview-Assessment-Platform/
├── 📂 frontend/
│   ├── 📂 my-react-app/          # Main React application
│   │   ├── 📂 src/
│   │   │   ├── 📂 components/    # React components
│   │   │   │   ├── AptitudeTest.jsx
│   │   │   │   ├── CodingTest.jsx
│   │   │   │   ├── CompanySelect.jsx
│   │   │   │   ├── LevelSelect.jsx
│   │   │   │   ├── TestTypeSelect.jsx
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── Profile.jsx
│   │   │   │   ├── Result.jsx
│   │   │   │   ├── Navbar.jsx
│   │   │   │   ├── Login.jsx
│   │   │   │   ├── CompanyHeader.jsx
│   │   │   │   ├── CompanyLogo.jsx
│   │   │   │   ├── GlassCard.jsx
│   │   │   │   └── DynamicBackground.jsx
│   │   │   ├── 📂 contexts/      # React Context API
│   │   │   │   └── TestContext.jsx
│   │   │   ├── 📂 styles/        # Global styles
│   │   │   ├── App.jsx           # Main App component
│   │   │   ├── api.jsx           # API client setup
│   │   │   ├── main.jsx          # Entry point
│   │   │   └── index.jsx
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── index.html
│   └── package.json
│
├── 📂 backend/
│   ├── main.py                   # FastAPI application
│   ├── data_loader.py            # Question data loading logic
│   ├── 📂 utils/
│   │   └── feedback.py           # AI feedback generation
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # Environment variables
│   ├── user_profiles.json        # User data storage
│   ├── users.json                # User credentials
│   └── test.http                 # API test file
│
├── 📂 data/
│   ├── 📂 aptitude/              # Aptitude question datasets
│   │   ├── amazon.json
│   │   ├── tcs.json
│   │   ├── infosys.json
│   │   ├── wipro.json
│   │   └── accenture.json
│   ├── 📂 coding/                # Coding challenge datasets
│   │   ├── amazon.json
│   │   ├── tcs.json
│   │   ├── infosys.json
│   │   ├── wipro.json
│   │   └── accenture.json
│   └── companies.json            # Company list
│
├── package.json
├── package-lock.json
└── README.md                      # This file
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js** ≥ 16.0.0
- **npm** ≥ 8.0.0
- **Python** ≥ 3.8
- **pip** (Python package manager)

### Step 1: Clone the Repository
```bash
git clone https://github.com/PRITIK03/ReactNodeInterviewMatrix---Comprehensive-Interview-Assessment-Platform.git
cd ReactNodeInterviewMatrix---Comprehensive-Interview-Assessment-Platform
```

### Step 2: Backend Setup

#### Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Judge0 API (Optional, for code execution)
JUDGE0_KEY=your_judge0_api_key_here
JUDGE0_URL=https://judge0-ce.p.rapidapi.com

# Server Configuration
HOST=0.0.0.0
PORT=8000
```

**How to get API keys:**
- **Google Gemini**: Visit [Google AI Studio](https://aistudio.google.com/app/apikeys)
- **Judge0**: Register at [Judge0 RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce)

#### Start Backend Server
```bash
cd backend
python -m uvicorn main:app --reload
```

Server runs at: `http://localhost:8000`

### Step 3: Frontend Setup

#### Install Dependencies
```bash
cd frontend/my-react-app
npm install
```

#### Start Development Server
```bash
npm run dev
```

Application opens at: `http://localhost:5173`

### Step 4: Verify Installation
- ✅ Backend API accessible: `http://localhost:8000/api/companies`
- ✅ Frontend loads: `http://localhost:5173`
- ✅ Network requests working (check browser console)

---

## ⚙️ Configuration

### Backend Configuration

**FastAPI CORS Settings** (in `backend/main.py`):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Modify `allow_origins` to include your production URLs.

### Frontend Configuration

**API Base URL** (in `frontend/my-react-app/src/api.jsx`):
```javascript
const API = axios.create({
  baseURL: "http://localhost:8000/api",
  withCredentials: true
});
```

Update `baseURL` for production deployment.

### Database Configuration

The application uses **JSON files** for persistence:
- `backend/user_profiles.json` - User test history
- `backend/users.json` - User credentials

For production, consider migrating to:
- MongoDB
- PostgreSQL
- Firebase Realtime Database

---

## 📖 Usage

### User Journey

#### 1️⃣ **Login**
```
/ (Login Page)
├─ Enter username & password
└─ Navigate to Dashboard
```

#### 2️⃣ **Select Test Parameters**
```
/dashboard (Main Dashboard)
└─ /company (Choose: Amazon, TCS, Infosys, Wipro, Accenture)
   └─ /level (Select: Beginner, Intermediate, Advanced)
      └─ /type (Choose: Aptitude or Coding)
```

#### 3️⃣ **Take Test**
```
/aptitude or /coding
├─ Answer questions
├─ Submit responses
└─ View real-time feedback
```

#### 4️⃣ **Review Results**
```
/result
├─ Score display
├─ AI-generated feedback
├─ Section-wise analysis
└─ Recommendations
```

#### 5️⃣ **Track Progress**
```
/profile
├─ Test history
├─ Performance metrics
├─ Analytics & charts
└─ Improvement recommendations
```

### Example API Calls

#### Get Aptitude Questions
```bash
curl -X POST http://localhost:8000/api/aptitude \
  -H "Content-Type: application/json" \
  -d '{"company": "amazon", "level": "beginner"}'
```

#### Submit Aptitude Test
```bash
curl -X POST http://localhost:8000/api/aptitude/submit \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "company": "amazon",
    "level": "beginner",
    "answers": ["A", "B", "C"],
    "questions": [...]
  }'
```

#### Get User Profile
```bash
curl http://localhost:8000/api/profile?username=john_doe
```

---

## 📡 API Endpoints

### Questions & Tests

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/aptitude` | Get aptitude questions for company & level |
| POST | `/api/coding` | Get coding challenges for company & level |
| GET | `/api/companies` | List all available companies |

### Test Submission

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/aptitude/submit` | Submit aptitude test answers |
| POST | `/api/coding/submit` | Submit coding solutions |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile?username={username}` | Get user profile & test history |

### Request/Response Examples

#### Aptitude Submit Request
```json
{
  "username": "john_doe",
  "company": "amazon",
  "level": "beginner",
  "answers": ["A", "B", "C", "D"],
  "questions": [
    {
      "id": 1,
      "question": "What is 2+2?",
      "answer": "A",
      "options": ["A", "B", "C", "D"],
      "category": "Quantitative"
    }
  ]
}
```

#### Aptitude Submit Response
```json
{
  "score": 3,
  "total": 4,
  "feedback": "**Your Aptitude Test Results**\nScore: 3/4\n**Section Performance:** Quantitative: 75%\n...",
  "ai_report": {
    "section_scores": {"quantitative": 75, "logical": 100},
    "weak_sections": ["quantitative"],
    "recommendations": ["Practice quantitative aptitude problems"],
    "summary": "Your strengths: Logical (100%). Improve your Quantitative skills (75%) for better results."
  }
}
```

---

## 🏗️ Architecture

### System Design

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT (React + Vite)                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Components: Login, Tests, Dashboard, Results   │   │
│  │  State: React Context + Local Storage           │   │
│  │  Styling: Material-UI + Framer Motion           │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST (Axios)
                       │ CORS Enabled
┌──────────────────────▼──────────────────────────────────┐
│              SERVER (FastAPI + Python)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Endpoints: /api/aptitude, /api/coding, etc.    │   │
│  │  Middleware: CORS, Error Handling               │   │
│  │  Data Layer: JSON file persistence              │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ External APIs
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   Google Gemini   Judge0 API    File System
   (AI Review)   (Code Exec.)   (JSON Storage)
```

### Data Flow

```
User Login
    ↓
Select Company & Level
    ↓
Choose Test Type (Aptitude/Coding)
    ↓
Fetch Questions from Backend
    ↓
Answer Questions/Write Code
    ↓
Submit Answers to API
    ↓
Backend Processing:
  ├─ Calculate Score
  ├─ Generate AI Feedback (Gemini)
  ├─ Analyze Performance
  └─ Save to user_profiles.json
    ↓
Display Results & Recommendations
    ↓
Store in User Profile (persistent)
```

---

## 🔧 Key Components

### Frontend Components

#### **Login.jsx**
- User authentication form
- Username/password validation
- Session management

#### **CompanySelect.jsx**
- List of 5 companies with logos
- Company selection with visual feedback
- Navigation to level selection

#### **LevelSelect.jsx**
- Difficulty level selection (Beginner, Intermediate, Advanced)
- Level description & duration info
- Proceeds to test type selection

#### **TestTypeSelect.jsx**
- Choose between Aptitude or Coding tests
- Test description and info

#### **AptitudeTest.jsx**
- Question display with options
- Question navigation (previous/next)
- Timer display
- Progress indicator
- Submit functionality

#### **CodingTest.jsx**
- Code editor with syntax highlighting
- Language selection dropdown
- Problem description panel
- Code submission
- Realtime feedback display

#### **Dashboard.jsx**
- Welcome message for logged-in users
- Quick access to test types
- Recent test history
- Performance summary cards
- Statistics visualization

#### **Profile.jsx**
- User test history with filtering
- Performance analytics with Chart.js
- Detailed test results breakdown
- Strength/weakness analysis

#### **Result.jsx**
- Score display with animations
- AI-generated feedback in markdown
- Section-wise performance breakdown
- Recommendations and next steps
- Retry or return options

#### **Navbar.jsx**
- Navigation menu
- User greeting with logout
- Links to dashboard, profile, and test pages

### Backend Modules

#### **main.py**
- FastAPI application initialization
- Route definitions
- Request handling and response generation
- Profile management
- CORS configuration

#### **data_loader.py**
- Load questions from JSON files
- Filter by company and difficulty level
- Error handling for missing files

#### **utils/feedback.py**
- Calculate section-wise scores
- Identify weak areas
- Generate personalized recommendations
- Create performance summary

### Data Structures

#### Question Format (Aptitude)
```json
{
  "id": 1,
  "question": "What is the sum of 2+2?",
  "options": ["3", "4", "5", "6"],
  "answer": "4",
  "category": "Quantitative",
  "difficulty": "beginner"
}
```

#### Question Format (Coding)
```json
{
  "id": 1,
  "title": "Two Sum",
  "description": "Given an array of integers...",
  "examples": [
    {
      "input": "[2,7,11,15], target=9",
      "output": "[0,1]"
    }
  ],
  "difficulty": "beginner"
}
```

#### User Profile Format
```json
{
  "username": {
    "tests": [
      {
        "company": "amazon",
        "type": "aptitude",
        "level": "beginner",
        "score": 8,
        "total": 10,
        "feedback": "..."
      }
    ]
  }
}
```

---

## 🚀 Deployment Guide

### Frontend Deployment (Vercel/Netlify)

1. **Build the application:**
   ```bash
   cd frontend/my-react-app
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel
   ```

3. **Update API URL** in `src/api.jsx` to production backend

### Backend Deployment (Heroku/Railway)

1. **Create `Procfile`:**
   ```
   web: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```

2. **Set environment variables** in platform dashboard

3. **Deploy:**
   ```bash
   git push heroku main
   ```

---

## 🔐 Security Considerations

- [ ] Implement proper JWT authentication
- [ ] Add rate limiting on API endpoints
- [ ] Validate all user inputs
- [ ] Use HTTPS in production
- [ ] Secure API keys in environment variables
- [ ] Implement database encryption
- [ ] Add CSRF protection
- [ ] Sanitize user-generated content

---

## 🐛 Troubleshooting

### CORS Errors
**Problem**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution**: 
- Verify `allow_origins` in `backend/main.py`
- Ensure frontend URL matches configured origin
- Check backend is running on correct port

### API Connection Failed
**Problem**: `Failed to fetch /api/companies`

**Solution**:
- Start backend server: `uvicorn main:app --reload`
- Check backend URL in `frontend/src/api.jsx`
- Verify no firewall blocking port 8000

### Missing Environment Variables
**Problem**: `KeyError: GEMINI_API_KEY`

**Solution**:
- Create `.env` file in `backend/` directory
- Add valid API keys
- Restart backend server

### Tests Not Loading
**Problem**: `Empty questions array`

**Solution**:
- Verify JSON files exist in `data/aptitude/` and `data/coding/`
- Check file names match company names (lowercase)
- Ensure JSON structure is valid

---

## 📈 Future Enhancements

- [ ] **Database Integration** - Migrate from JSON to proper database
- [ ] **Real Code Execution** - Integrate Judge0 API for code testing
- [ ] **Leaderboard** - Competitive scoring across users
- [ ] **Practice Mode** - Unlimited practice questions
- [ ] **Video Tutorials** - Topic explanations and tips
- [ ] **Timed Contests** - Live mock interviews with time limits
- [ ] **Mobile App** - React Native mobile version
- [ ] **Interview Scheduling** - Book live interviews with mentors
- [ ] **Resume Upload** - Company-specific resume optimization
- [ ] **Advanced Analytics** - ML-based performance predictions
- [ ] **Collaborative Learning** - Discussion forums
- [ ] **Payment Integration** - Premium features subscription

---

## 🤝 Contributing

Contributions are welcome! Here's how to contribute:

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ReactNodeInterviewMatrix.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Commit changes**
   ```bash
   git commit -m "Add amazing feature"
   ```

4. **Push to branch**
   ```bash
   git push origin feature/amazing-feature
   ```

5. **Open a Pull Request**

### Coding Standards
- Follow PEP 8 for Python code
- Use ESLint for JavaScript
- Add tests for new features
- Update documentation

---

## 📞 Support & Contact

- **GitHub Issues**: [Report bugs](https://github.com/PRITIK03/ReactNodeInterviewMatrix---Comprehensive-Interview-Assessment-Platform/issues)
- **Email**: pritikkumar03@gmail.com
- **GitHub Profile**: [@PRITIK03](https://github.com/PRITIK03)

---

## 📄 License

This project is open source and available under the **MIT License**. See LICENSE file for details.

---

## 🙏 Acknowledgments

- **Google Gemini AI** - For intelligent code reviews
- **Material-UI** - For beautiful UI components
- **FastAPI** - For modern Python backend
- **React Community** - For excellent documentation
- **All contributors** who have helped improve this project

---

## 📊 Project Statistics

- **Total Components**: 15+
- **Supported Companies**: 5
- **Test Types**: 2 (Aptitude + Coding)
- **Difficulty Levels**: 3 (Beginner, Intermediate, Advanced)
- **API Endpoints**: 6+
- **Questions**: 100+ (20 questions per company-level combination)
- **Lines of Code**: 5000+

---

<div align="center">

**Made with ❤️ by [PRITIK03](https://github.com/PRITIK03)**

⭐ If you find this project helpful, please consider giving it a star!

[⬆ Back to top](#-reactinterviewpro---ai-powered-mock-interview-platform)

</div>
