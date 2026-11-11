import { useState } from 'react';
import { GraduationCap, MapPin, Phone, Mail, Facebook, Twitter, Instagram, Youtube, Linkedin, Send, Check } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const footerLinks = {
    academic: [
      { label: 'Admission Process', href: '#' },
      { label: 'Academic Calendar', href: '#' },
      { label: 'Examination Results', href: '#' },
      { label: 'Course Catalog', href: '#' },
      { label: 'Library Resources', href: '#' },
      { label: 'Co-curricular Activities', href: '#' },
    ],
    about: [
      { label: 'About Us', href: '#' },
      { label: "Principal's Message", href: '#' },
      { label: 'History & Heritage', href: '#' },
      { label: 'Faculty & Staff', href: '#' },
      { label: 'Campus Facilities', href: '#' },
      { label: 'Accreditation', href: '#' },
    ],
    support: [
      { label: 'Contact Us', href: '#' },
      { label: 'FAQs', href: '#' },
      { label: 'Student Portal', href: '#' },
      { label: 'Alumni Network', href: '#' },
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
    ],
  };

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Youtube, href: '#', label: 'YouTube' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
  ];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 4000);
  };

  return (
    <footer className="bg-gray-950 text-gray-300 relative overflow-hidden">
      <div className="absolute inset-0 hero-pattern opacity-30" aria-hidden="true" />
      <div className="absolute -top-40 right-0 w-96 h-96 bg-green-600/10 rounded-full blur-3xl" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        {/* Newsletter */}
        <div className="mb-14 p-8 md:p-10 rounded-3xl bg-gradient-to-br from-green-800 to-green-950 border border-green-700/30 relative overflow-hidden">
          <div className="absolute inset-0 hero-pattern opacity-40" aria-hidden="true" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1">
              <h3 className="font-display text-2xl font-bold text-white mb-2">Stay Updated</h3>
              <p className="text-green-100 max-w-xl">
                Subscribe to our newsletter for admission deadlines, exam schedules, and college news.
              </p>
            </div>
            {subscribed ? (
              <div className="flex items-center gap-3 bg-green-500/20 border border-green-400/30 text-green-200 px-6 py-4 rounded-2xl animate-scale-in">
                <span className="inline-flex p-2 rounded-full bg-green-500 text-white">
                  <Check size={18} />
                </span>
                <span className="font-medium">Subscribed successfully!</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex w-full max-w-md gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 px-5 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-green-200/60 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                  aria-label="Email address"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-amber-400 text-amber-950 px-6 py-3.5 rounded-xl font-semibold text-sm hover:bg-amber-300 transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] flex-shrink-0"
                >
                  <Send size={16} />
                  <span className="hidden sm:inline">Subscribe</span>
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Sufia Motin Mohila College crest"
                className="w-12 h-12 rounded-xl object-cover shadow-lift bg-white"
              />
              <div>
                <h3 className="font-display text-xl font-bold text-white leading-tight">Sufia Motin Mohila College</h3>
                <p className="text-xs text-green-400 font-medium">Estd. 2000</p>
              </div>
            </div>
            <p className="text-gray-400 leading-relaxed max-w-xs">
              A premier educational institution for women in Bangladesh offering quality education
              in HSC, Degree, and Honours programs. Nurturing minds and building futures since 2000.
            </p>
            <div className="flex items-center gap-3 pt-2">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    className="w-10 h-10 rounded-xl bg-gray-800/80 text-gray-400 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 shadow-sm"
                    aria-label={social.label}
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Academic Links */}
          <div>
            <h4 className="text-white font-semibold mb-5 font-display">Academic</h4>
            <ul className="space-y-3">
              {footerLinks.academic.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="group text-sm text-gray-400 hover:text-green-400 transition-colors flex items-center gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* About Links */}
          <div>
            <h4 className="text-white font-semibold mb-5 font-display">About College</h4>
            <ul className="space-y-3">
              {footerLinks.about.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="group text-sm text-gray-400 hover:text-green-400 transition-colors flex items-center gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-5 font-display">Contact Us</h4>
            <address className="not-italic space-y-4 text-sm">
              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 text-gray-400 hover:text-green-400 transition-colors"
              >
                <MapPin size={18} className="mt-0.5 flex-shrink-0 text-green-400" />
                <span className="leading-relaxed">Jatrapasha (3351), Baniachong, Habiganj<br />Bangladesh</span>
              </a>
              <a
                href="tel:01716584863"
                className="flex items-center gap-3 text-gray-400 hover:text-green-400 transition-colors"
              >
                <Phone size={18} className="flex-shrink-0 text-green-400" />
                <span>01716-584863</span>
              </a>
              <a
                href="mailto:sufiamotinmohilacollege@gmail.com"
                className="flex items-center gap-3 text-gray-400 hover:text-green-400 transition-colors"
              >
                <Mail size={18} className="flex-shrink-0 text-green-400" />
                <span className="break-all">sufiamotinmohilacollege@gmail.com</span>
              </a>
            </address>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            &copy; {currentYear} Sufia Motin Mohila College. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <a href="#" className="hover:text-green-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-green-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-green-400 transition-colors">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
