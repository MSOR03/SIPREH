# DroughtMonitor 🌧️

A comprehensive web-based dashboard for drought monitoring, historical analysis, and prediction in Bogotá, Colombia. This application provides real-time visualization of hydrometeorological variables, drought indices, and predictive analytics based on macroclimatic phenomena correlations.

## 📋 Overview

DroughtMonitor is designed to support decision-making in water resource management by providing:

- **Historical Analysis**: Visualization of hydrometeorological variables and drought indices over the past 30 years
- **Predictive Analytics**: Drought predictions based on macroclimatic phenomena correlations (ENSO, PDO, NAO)
- **Interactive Mapping**: Spatial visualization of drought conditions across Bogotá's monitoring network
- **Data Export**: Export capabilities for charts and data in multiple formats (CSV, PNG, JPEG)

## ✨ Features

### Historical Analysis
- **Hydrometeorological Variables**: Precipitation, Temperature, Evapotranspiration (ET), Flow Rate
- **Drought Indices**: 
  - SPI (Standardized Precipitation Index)
  - SPEI (Standardized Precipitation Evapotranspiration Index)
  - PDSI (Palmer Drought Severity Index)
  - SSI (Streamflow Drought Index)
  - SWI (Soil Water Index)
- **Time Series Visualization**: 1D plots for individual stations
- **Spatial Visualization**: 2D heat maps across the entire grid domain
- **Date Range Selection**: Flexible date picker for custom analysis periods

### Prediction Module
- **Drought Index Forecasting**: Predictions for all supported drought indices
- **Macroclimatic Correlations**: Integration with ENSO, PDO, and NAO phenomena
- **Time Horizons**: 1-month, 3-month, and 6-month predictions
- **Spatial Predictions**: 2D visualization of forecasted conditions

### Interactive Mapping
- **OpenStreetMap Integration**: High-quality base maps with Leaflet
- **5 Monitoring Stations**: Interactive station markers with detailed information
- **Grid System**: ~5km discretization cells covering Bogotá
- **Click Interactions**: Select stations for detailed time series
- **Navigation Controls**: Zoom, pan, and reset functionality
- **Map Elements**: North arrow indicator, metric scale bar

### User Experience
- **Dark/Light Theme**: Toggle between display modes for different viewing conditions
- **Responsive Design**: Optimized for various screen sizes
- **Toast Notifications**: Real-time feedback for user actions
- **Modal Dialogs**: Contextual information and confirmations
- **Loading States**: Visual feedback during data operations

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 16.1.6](https://nextjs.org/) with React 19.2.3
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Mapping**: [Leaflet 1.9.4](https://leafletjs.com/) + [React Leaflet 4.2.1](https://react-leaflet.js.org/)
- **Charts**: [Recharts 2.14.1](https://recharts.org/)
- **Icons**: [Lucide React 0.460.0](https://lucide.dev/)
- **Date Handling**: [date-fns 4.1.0](https://date-fns.org/)
- **Linting**: ESLint 9 with Next.js config

### Backend (Planned)
- Backend API integration is planned for future development
- API endpoints are pre-configured in the frontend (see Configuration section)

## 📁 Project Structure

```
DroughtMonitor/
├── drought-frontend/          # Next.js frontend application
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── app/             # Next.js app directory
│   │   │   ├── layout.js    # Root layout component
│   │   │   ├── page.js      # Main dashboard page
│   │   │   └── globals.css  # Global styles
│   │   ├── components/      # React components
│   │   │   ├── Header.js    # Application header
│   │   │   ├── Sidebar.js   # Control panel sidebar
│   │   │   ├── MapArea.js   # Map visualization area
│   │   │   ├── LeafletMap.js # Leaflet map implementation
│   │   │   ├── Footer.js    # Application footer
│   │   │   └── ui/          # Reusable UI components
│   │   │       ├── Button.js
│   │   │       ├── Select.js
│   │   │       ├── DateRangePicker.js
│   │   │       ├── Modal.js
│   │   │       └── Toast.js
│   │   ├── contexts/        # React context providers
│   │   │   ├── ThemeContext.js  # Theme management
│   │   │   ├── ToastContext.js  # Toast notifications
│   │   │   └── ModalContext.js  # Modal dialogs
│   │   └── config/          # Configuration files
│   │       └── constants.js # API endpoints, map config
│   ├── package.json         # Dependencies and scripts
│   └── REQUERIMIENTOS_VALIDACION.md # Implementation validation
├── drought-backend/          # Backend API (planned)
├── documents/               # Project documentation
│   └── dashboard_struct.pdf # Dashboard specifications
└── README.md               # This file
```

## 🚀 Installation and Setup

### Prerequisites
- Node.js 18.x or higher
- npm or yarn package manager

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd DroughtMonitor
```

2. **Install frontend dependencies**
```bash
cd drought-frontend
npm install
```

3. **Set up environment variables (optional)**

Create a `.env.local` file in the `drought-frontend` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Running the Application

#### Development Mode
```bash
cd drought-frontend
npm run dev
```

The application will be available at `http://localhost:3000`

#### Production Build
```bash
cd drought-frontend
npm run build
npm start
```

#### Linting
```bash
npm run lint
```

## 💻 Usage

### Historical Analysis Workflow

1. **Select a Variable or Drought Index**
   - Choose from hydrometeorological variables (Precipitation, Temperature, ET, Flow Rate)
   - OR select a drought index (SPI, SPEI, PDSI, SSI, SWI)

2. **Set Date Range**
   - Use the date range picker to select start and end dates
   - System supports up to 30 years of historical data

3. **Select a Station (Optional)**
   - Click on any of the 5 monitoring stations on the map
   - For 1D time series visualization at specific locations

4. **Generate Plot**
   - Click the "Graficar" button in the Historical Analysis panel
   - View results in the visualization area below the map

5. **Export Data**
   - Click "Guardar" to export data
   - Choose between CSV, PNG, or JPEG formats

### Prediction Workflow

1. **Select Drought Index**
   - Choose the drought index to predict

2. **Select Macroclimatic Index (Optional)**
   - Choose correlation with ENSO, PDO, or NAO

3. **Set Time Horizon**
   - Select 1-month, 3-month, or 6-month prediction

4. **Generate Prediction**
   - Click "Graficar" in the Prediction panel
   - View spatial predictions on the map

5. **Export Results**
   - Use the "Guardar" button to export prediction results

### Map Interactions

- **Zoom**: Use controls in the top-right corner or scroll wheel
- **Pan**: Click and drag the map
- **Select Station**: Click on station markers for detailed info
- **Reset**: Click the "Reset" button to clear all visualizations

## ⚙️ Configuration

### API Endpoints

The application is configured to connect to a backend API. Edit `src/config/constants.js` to modify endpoints:

```javascript
export const API_BASE_URL = 'http://localhost:8000';

export const API_ENDPOINTS = {
  getHistoricalData: '/api/historical/data',
  getPrediction: '/api/prediction/drought-index',
  // ... more endpoints
};
```

### Map Configuration

Modify map settings in `src/config/constants.js`:

```javascript
export const MAP_CONFIG = {
  center: [4.7110, -74.0721], // Bogotá center coordinates
  zoom: 10,
  bounds: [[4.4, -74.3], [5.0, -73.9]], // Map boundaries
};
```

### Monitoring Stations

Station data can be configured in `src/config/constants.js`:

```javascript
export const STATIONS = [
  { id: 1, name: 'Station Name', lat: 4.7110, lon: -74.0721 },
  // ... more stations
];
```

## 🎨 Component Overview

### Core Components
- **Header**: Application branding, theme toggle, status indicator
- **Sidebar**: Control panels for analysis and prediction
- **MapArea**: Main visualization area with Leaflet map
- **Footer**: Credits and additional information

### UI Components
- **Button**: Reusable button with variants (primary, secondary, success, danger)
- **Select**: Dropdown component for option selection
- **DateRangePicker**: Date range selection with validation
- **Modal**: Dialog system for confirmations and information
- **Toast**: Notification system with multiple types (success, warning, error, info)

### Context Providers
- **ThemeContext**: Manages dark/light theme state
- **ToastContext**: Provides toast notification functionality
- **ModalContext**: Manages modal dialogs

## 🔄 Future Development

### Backend Integration
- RESTful API development for data processing
- Database integration for historical data storage
- Real-time data ingestion from monitoring stations
- Machine learning models for prediction algorithms

### Planned Features
- User authentication and authorization
- Customizable dashboards
- Alert system for drought conditions
- Historical data upload functionality
- Advanced statistical analysis tools
- Mobile application

## 📝 Implementation Status

The frontend dashboard is **fully implemented** according to the original specifications. See [REQUERIMIENTOS_VALIDACION.md](drought-frontend/REQUERIMIENTOS_VALIDACION.md) for detailed validation checklist.

### Completed ✅
- All UI components and layouts
- Interactive map with stations and grid
- Historical analysis controls
- Prediction module controls
- Theme switching
- Notification system
- Responsive design
- Export functionality (UI ready)

### Pending ⏳
- Backend API implementation
- Real data integration
- Actual plotting with backend data
- File export backend processing
- User authentication

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- Development Team - Initial work and implementation

## 📞 Contact

For questions or support, please contact the development team.

## 🙏 Acknowledgments

- OpenStreetMap contributors for map data
- Leaflet community for mapping library
- Next.js team for the excellent framework
- All open-source library contributors

---

**Last Updated**: February 2026
