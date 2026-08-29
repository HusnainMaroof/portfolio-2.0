import AboutMe from './_components/AboutMe';
import Banner from './_components/Banner';
import Experiences from './_components/Experiences';
import Skills from './_components/Skills';
import ProjectsSection from './_components/Project';

export default function Home() {
    return (
        <div className="page-">
            <Banner />
            <ProjectsSection />
            <Skills />
            <Experiences />
        </div>
    );
}
