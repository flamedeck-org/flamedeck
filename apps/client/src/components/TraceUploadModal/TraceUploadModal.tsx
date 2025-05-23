import { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UploadDialog } from '@/components/UploadDialog';
import { useTraceUploadModal } from '@/hooks/useTraceUploadModal';

function TraceUploadModalImpl() {
    const { isOpen, closeModal, droppedFile, targetFolderId } = useTraceUploadModal();

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            closeModal();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>{droppedFile ? 'Upload Dropped Trace' : 'Upload Trace'}</DialogTitle>
                </DialogHeader>
                <UploadDialog
                    initialFolderId={targetFolderId}
                    initialFile={droppedFile}
                    onClose={closeModal}
                />
            </DialogContent>
        </Dialog>
    );
}

export const TraceUploadModal = memo(TraceUploadModalImpl); 