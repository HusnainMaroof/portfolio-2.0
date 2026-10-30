import Banner from './_components/Banner';
// import ClientProof from './_components/ClientProof';
// import Approach from './_components/Approach';
import Experiences from './_components/Experiences';
import Skills from './_components/Skills';
import SelectedWork from './_components/SelectedWork';
import { PROJECTS } from '@/lib/data';
// import { TESTIMONIAL_SHOTS } from '@/lib/testimonials';

export default function Home() {
    const hasProjects = PROJECTS.length > 0;
    // const hasTestimonials = TESTIMONIAL_SHOTS.length > 0;

    return (
        <div className="page-">
            <Banner />
            {/* <Approach /> */}
            {hasProjects && <SelectedWork />}
            <Skills />
            <Experiences />
            {/* {hasTestimonials && hasProjects && <ClientProof />} */}
        </div>
    );
}
