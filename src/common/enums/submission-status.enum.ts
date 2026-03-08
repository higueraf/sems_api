export enum SubmissionStatus {
  RECEIVED = 'received',           // Initial state on submission
  UNDER_REVIEW = 'under_review',   // Assigned to evaluator
  REVISION_REQUESTED = 'revision_requested', // Author must revise
  APPROVED = 'approved',           // Accepted for publication/presentation
  REJECTED = 'rejected',           // Not accepted
  WITHDRAWN = 'withdrawn',         // Author withdrew the submission
  SCHEDULED = 'scheduled',         // Assigned a slot in the agenda
}

export enum AgendaSlotType {
  KEYNOTE = 'keynote',
  PRESENTATION = 'presentation',
  BREAK = 'break',
  CEREMONY = 'ceremony',
  WORKSHOP = 'workshop',
  PANEL = 'panel',
}

export enum OrganizerType {
  INSTITUTION = 'institution',
  PERSON = 'person',
}

export enum OrganizerRole {
  HOST = 'host',
  CO_ORGANIZER = 'co_organizer',
  SPONSOR = 'sponsor',
  SCIENTIFIC_COMMITTEE = 'scientific_committee',
  ORGANIZING_COMMITTEE = 'organizing_committee',
  KEYNOTE_SPEAKER = 'keynote_speaker',
  CONTACT = 'contact',
}

export enum EventFormat {
  IN_PERSON = 'in_person',
  ONLINE = 'online',
  HYBRID = 'hybrid',
}

export enum GuidelineCategory {
  FORMAT = 'format',
  SUBMISSION = 'submission',
  EVALUATION = 'evaluation',
  PUBLICATION = 'publication',
  GENERAL = 'general',
}
