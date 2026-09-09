/**
 * Όλα τα κείμενα της εφαρμογής σε ένα σημείο.
 * ΚΑΝΟΝΑΣ: ποτέ CSS text-transform σε ελληνικά — τα κεφαλαία γράφονται εδώ, χωρίς τόνους.
 */
export const S = {
  appTitle: 'Στούντιο Μακιγιάζ',
  play: 'Παίξε',
  gallery: 'Γκαλερί',
  fullscreen: 'Πλήρης οθόνη',
  exitFullscreen: 'Έξοδος από πλήρη οθόνη',
  soundOn: 'Ήχος: ναι',
  soundOff: 'Ήχος: όχι',

  chooseTitle: 'Διάλεξε το μοντέλο σου',
  whatsYourName: 'Πώς σε λένε;',
  namePlaceholder: 'Το όνομά σου',
  letsGo: 'Πάμε!',
  back: 'Πίσω',

  undo: 'Αναίρεση',
  clear: 'Καθάρισε',
  save: 'Αποθήκευση',
  changeFace: 'Άλλο πρόσωπο',
  model: 'Μοντέλο',
  photo: 'Φωτογραφία',
  ideas: 'Ιδέες',

  photoTitle: 'Φωτογράφισε τη δημιουργία μου',
  photoBg: 'Φόντο',
  photoBgPlain: 'Απλό',
  photoBgDots: 'Πουά',
  photoBgWhite: 'Λευκό',
  photoSave: 'Αποθήκευση εικόνας',
  photoShared: 'Η φωτογραφία είναι έτοιμη!',
  photoDownloaded: 'Η φωτογραφία κατέβηκε!',
  photoFailed: 'Δεν έγινε η φωτογραφία, δοκίμασε ξανά',

  cardsTitle: 'Κάρτες έμπνευσης',
  cardsNone: 'Χωρίς κάρτα',
  cardDone: 'Μπράβο! Τα κατάφερες!',

  hintIdle: 'Διάλεξε ένα καλλυντικό και σύρε το πάνω στο πρόσωπο',
  hintDropHere: 'Άφησέ το εδώ!',
  hintNotHere: 'Όχι εκεί — δοκίμασε πάνω στο πρόσωπο',
  hintDone: 'Τέλειο!',
  hintCleared: 'Καθαρό πρόσωπο! Ξεκίνα ξανά',
  hintRemoved: 'Σβήστηκε!',
  hintNothingToRemove: 'Δεν υπάρχει κάτι εδώ για σβήσιμο',

  groupFace: 'Πρόσωπο',
  groupEyes: 'Μάτια',
  groupLips: 'Χείλη',
  groupHair: 'Μαλλιά',
  groupFun: 'Έξτρα',

  confirmClearTitle: 'Να καθαρίσω όλο το μακιγιάζ;',
  confirmClearBody: 'Το πρόσωπο θα γίνει όπως ήταν στην αρχή.',
  no: 'Όχι',
  yesClear: 'Ναι, καθάρισε',
  cancel: 'Άκυρο',

  saveTitle: 'Αποθήκευση έργου',
  projectName: 'Όνομα έργου',
  modelName: 'Όνομα μοντέλου',
  defaultProjectName: (n: number) => `Μακιγιάζ ${n}`,
  saved: 'Αποθηκεύτηκε!',
  savedNoThumb: 'Αποθηκεύτηκε χωρίς φωτογραφία',
  galleryFull: 'Η γκαλερί είναι γεμάτη — σβήσε κάποιο έργο',
  storageUnavailable: 'Δεν υπάρχει χώρος αποθήκευσης σε αυτόν τον browser',

  galleryTitle: 'Η γκαλερί μου',
  galleryEmpty: 'Δεν έχεις αποθηκεύσει ακόμα κάτι',
  open: 'Άνοιγμα',
  delete: 'Διαγραφή',
  confirmDeleteTitle: 'Να σβήσω αυτό το έργο;',
  yesDelete: 'Ναι, σβήσε το',
  leaveUnsavedTitle: 'Το μακιγιάζ δεν έχει αποθηκευτεί',
  leaveUnsavedBody: 'Θέλεις να φύγεις χωρίς αποθήκευση;',
  yesLeave: 'Ναι, φύγε',

  loading: 'Φόρτωση…',
} as const;
