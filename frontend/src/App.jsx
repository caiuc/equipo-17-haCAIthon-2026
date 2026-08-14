import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { Problem } from "@/components/landing/Problem"
import { Solution } from "@/components/landing/Solution"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { TechNote } from "@/components/landing/TechNote"
import { FinalCta } from "@/components/landing/FinalCta"
import { Footer } from "@/components/landing/Footer"
import DashboardPage from "@/pages/DashboardPage"
import PassengerApp from "@/pages/PassengerApp"
import CompanyApp from "@/pages/CompanyApp"
import DriverApp from "@/pages/DriverApp"

function Landing() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <TechNote />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}

// El BrowserRouter vive AQUI y en ningun otro lado. main.jsx monta <App /> a
// secas, sin envolverlo: anidar dos Router hace que React Router lance "You
// cannot render a <Router> inside another <Router>" y la app entera se quede en
// blanco. Ya paso una vez; si vuelve a aparecer un BrowserRouter en main.jsx,
// ese es el bug.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/app" element={<PassengerApp />} />
        <Route path="/empresa" element={<CompanyApp />} />
        <Route path="/chofer" element={<DriverApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
