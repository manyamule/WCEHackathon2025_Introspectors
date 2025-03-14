import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Welcome from './pages/Welcome';
import FormPage from './pages/AirQualityForm';

import Navbar from "./components/Navbar";
import Footer from './components/Footer';


const App = () => {

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-100">
      <BrowserRouter>

      <Navbar />

        <Routes>

          <Route path="/" element={<Welcome />} />
          <Route path="/airqualityform" element={<FormPage />} />

        </Routes>

        <Footer />

        <ToastContainer />

      </BrowserRouter>

    </div>
  )
};

export default App