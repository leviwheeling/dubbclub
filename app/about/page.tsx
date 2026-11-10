import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {Arrow,UpRight} from "../components/icons";
import {ClubStory} from "./story";
import "./story.css";

export const metadata:Metadata={
  title:"About the club",
  description:"A dub is a win. DUBBCLUB makes training gear for the work that earns it.",
};

export default function About() {
  return <div className="about-page">
    <section className="about-cover" aria-labelledby="about-title">
      <Image src="/images/campaign.webp" alt="" fill sizes="100vw" loading="eager" fetchPriority="high"/>
      <div className="wrap about-cover-content">
        <h1 id="about-title">The win<br/>is yours.</h1>
        <div className="about-cover-foot">
          <p>For the people who keep showing up.</p>
          <a href="#club-story" aria-label="Scroll to the DUBBCLUB story" className="story-scroll"><Arrow/></a>
        </div>
      </div>
    </section>

    <section className="wrap about-intro" id="club-story" aria-labelledby="club-mission">
      <p className="eyebrow">OUR MISSION</p>
      <h2 id="club-mission">A dub is a win.<br/>We make gear for the work that earns it.</h2>
    </section>

    <ClubStory/>

    <section className="about-end">
      <div className="wrap about-end-inner">
        <div>
          <p className="eyebrow"><span className="tiny-dot"/> DUBBCLUB</p>
          <h2>Show up.<br/>Find your dub.</h2>
        </div>
        <Link className="button" href="/shop">Explore the collection <UpRight/></Link>
      </div>
    </section>
  </div>;
}
